cronAdd('sync_google_sheets', '0 6 * * *', () => {
  const SPREADSHEET_ID = '1buDNmxDKscXwe7iGNSwYEAVcm7646dsPpMHTSPyYg-I'
  const RANGE = 'BASE_GERAL'
  const API_KEY = $secrets.get('GOOGLE_API_KEY')
  const API_URL =
    'https://sheets.googleapis.com/v4/spreadsheets/' +
    SPREADSHEET_ID +
    '/values/' +
    RANGE +
    '?key=' +
    API_KEY
  const HTTP_TIMEOUT = 120
  const BATCH_SIZE = 1000
  const TX_SIZE = 200

  $app.logger().info('sync_google_sheets: starting scheduled sync')

  if (!API_KEY) {
    $app.logger().error('sync_google_sheets: GOOGLE_API_KEY secret is not set')
    return
  }

  let syncHistoryCol = null
  try {
    syncHistoryCol = $app.findCollectionByNameOrId('sync_history')
  } catch (_) {}

  const logSync = (status, rowsRead, rowsSaved, errorLog) => {
    if (!syncHistoryCol) return
    try {
      const logRecord = new Record(syncHistoryCol)
      logRecord.set('status', status)
      logRecord.set('rows_read', rowsRead)
      logRecord.set('rows_saved', rowsSaved)
      logRecord.set('error_log', errorLog || '')
      $app.saveNoValidate(logRecord)
    } catch (err) {
      $app.logger().error('sync_google_sheets: failed to log sync history', 'error', String(err))
    }
  }

  let res
  try {
    res = $http.send({
      url: API_URL,
      method: 'GET',
      timeout: HTTP_TIMEOUT,
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    $app.logger().error('sync_google_sheets: HTTP request failed', 'error', String(err))
    logSync('error', 0, 0, 'HTTP request failed: ' + String(err))
    return
  }

  if (res.statusCode !== 200) {
    $app.logger().error('sync_google_sheets: non-200 response', 'statusCode', res.statusCode)
    let errMsg = 'Google Sheets API returned status ' + res.statusCode
    if (res.json && res.json.error && res.json.error.message) {
      errMsg = res.json.error.message
    }
    logSync('error', 0, 0, errMsg)
    return
  }

  let responseBody = res.json
  if (!responseBody && typeof res.body === 'string') {
    try {
      responseBody = JSON.parse(res.body)
    } catch (parseErr) {
      logSync('error', 0, 0, 'Failed to parse JSON response: ' + String(parseErr))
      return
    }
  }

  if (!responseBody || !Array.isArray(responseBody.values)) {
    logSync('error', 0, 0, 'Google Sheets API response did not contain a values array')
    return
  }

  const values = responseBody.values
  $app.logger().info('sync_google_sheets: received values from API', 'totalRows', values.length)

  if (values.length < 2) {
    logSync('error', 0, 0, 'No data rows found — need at least 2 rows (got ' + values.length + ')')
    return
  }

  const headers = values[0].map((h) => {
    return String(h || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
  })

  const dataRows = values.slice(1).map((row) => {
    const obj = {}
    headers.forEach((h, i) => {
      obj[h] = row[i] !== undefined ? String(row[i]) : ''
    })
    return obj
  })

  const dedupedMap = {}
  const dedupedKeys = []
  for (let i = 0; i < dataRows.length; i++) {
    const ident = (dataRows[i]['identificacao'] || '').trim()
    const key = ident || '__no_ident_' + i
    if (!dedupedMap[key]) {
      dedupedKeys.push(key)
    }
    dedupedMap[key] = dataRows[i]
  }
  const dedupedRows = dedupedKeys.map((k) => dedupedMap[k])

  const totalRecords = dedupedRows.length
  $app
    .logger()
    .info(
      'sync_google_sheets: deduped records',
      'totalRecords',
      totalRecords,
      'originalRows',
      dataRows.length,
    )

  let col
  try {
    col = $app.findCollectionByNameOrId('servicos')
  } catch (err) {
    logSync('error', totalRecords, 0, 'servicos collection not found: ' + String(err))
    return
  }

  const existingMap = {}
  let mapOffset = 0
  while (true) {
    let existingBatch
    try {
      existingBatch = $app.findRecordsByFilter('servicos', "id != ''", 'created', 500, mapOffset)
    } catch (_) {
      break
    }
    if (existingBatch.length === 0) break
    for (let i = 0; i < existingBatch.length; i++) {
      const ident = existingBatch[i].getString('identificacao')
      if (ident) existingMap[ident] = existingBatch[i].id
    }
    mapOffset += 500
  }

  $app
    .logger()
    .info(
      'sync_google_sheets: built existing map',
      'existingCount',
      Object.keys(existingMap).length,
    )

  let saved = 0
  let errorCount = 0

  const parseDate = (raw) => {
    let d = raw || ''
    if (d) {
      const parts = d.split('/')
      if (parts.length === 3) {
        let day = parts[0]
        let month = parts[1]
        const year = parts[2]
        if (day.length < 2) day = '0' + day
        if (month.length < 2) month = '0' + month
        d = year + '-' + month + '-' + day
      }
    }
    if (!d) d = new Date().toISOString().slice(0, 10)
    return d
  }

  const parseValores = (raw) => {
    let v = (raw || '0').toString().replace(/[^0-9.,-]/g, '')
    if (v.indexOf(',') > -1 && v.indexOf('.') > -1) {
      v = v.replace(/\./g, '').replace(',', '.')
    } else if (v.indexOf(',') > -1) {
      v = v.replace(',', '.')
    }
    const n = parseFloat(v)
    return isNaN(n) ? 0 : n
  }

  try {
    for (let i = 0; i < totalRecords; i += BATCH_SIZE) {
      const batchEnd = Math.min(i + BATCH_SIZE, totalRecords)

      for (let j = i; j < batchEnd; j += TX_SIZE) {
        const txEnd = Math.min(j + TX_SIZE, batchEnd)

        $app.runInTransaction((txApp) => {
          for (let k = j; k < txEnd; k++) {
            try {
              const d = dedupedRows[k]
              const ident = (d['identificacao'] || '').trim()

              let record
              if (ident && existingMap[ident]) {
                try {
                  record = txApp.findRecordById('servicos', existingMap[ident])
                } catch (_) {
                  record = new Record(col)
                }
              } else {
                record = new Record(col)
              }

              record.set('identificacao', ident)
              record.set('data_servico', parseDate(d['data_servico']))
              record.set('valores', parseValores(d['valores']))
              record.set('tipo_video', d['tipo_video'] || '')
              record.set('especialista', d['especialista'] || '')
              record.set('observacoes', d['observacoes'] || '')
              record.set('mes_faturamento', d['mes_faturamento'] || '')
              record.set('video_bruto', d['video_bruto'] || '')
              record.set('video_editado', d['video_editado'] || '')
              record.set('editor', d['editor'] || '')

              txApp.saveNoValidate(record)

              if (ident && record.id) existingMap[ident] = record.id
              saved++
            } catch (recordErr) {
              errorCount++
              if (errorCount <= 10) {
                $app
                  .logger()
                  .warn(
                    'sync_google_sheets: skipped record',
                    'index',
                    k,
                    'error',
                    String(recordErr),
                  )
              }
            }
          }
        })
      }

      $app
        .logger()
        .info(
          'sync_google_sheets: progress',
          'processed',
          batchEnd,
          'of',
          totalRecords,
          'saved',
          saved,
          'errors',
          errorCount,
        )
    }

    const errorLog = errorCount > 0 ? errorCount + ' records skipped due to errors' : ''
    logSync('success', totalRecords, saved, errorLog)
    $app
      .logger()
      .info(
        'sync_google_sheets: sync completed',
        'saved',
        saved,
        'total',
        totalRecords,
        'errors',
        errorCount,
      )
  } catch (err) {
    $app.logger().error('sync_google_sheets: upsert failed', 'error', String(err))
    logSync('error', totalRecords, saved, 'Upsert failed: ' + String(err))
  }
})
