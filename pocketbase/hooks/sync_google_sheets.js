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

  var parseDate = (raw) => {
    var d = (raw || '').toString().trim()
    if (!d) return '2000-01-01 12:00:00'
    var parts = d.split(/[\/\-]/)
    if (parts.length === 3) {
      var day = parts[0].padStart(2, '0')
      var month = parts[1].padStart(2, '0')
      var year = parts[2]
      if (year.length === 2) year = '20' + year
      return year + '-' + month + '-' + day + ' 12:00:00'
    }
    return '2000-01-01 12:00:00'
  }

  var parseValores = (raw) => {
    if (typeof raw === 'number') return raw
    var v = (raw || '0').toString().trim()
    v = v
      .replace(/R\$/gi, '')
      .replace(/\s/g, '')
      .replace(/[^\d.,-]/g, '')
    if (!v) return 0
    if (v.indexOf(',') > -1 && v.indexOf('.') > -1) {
      v = v.replace(/\./g, '').replace(',', '.')
    } else if (v.indexOf(',') > -1) {
      v = v.replace(',', '.')
    }
    var n = parseFloat(v)
    return isNaN(n) ? 0 : n
  }

  var cellStr = (row, idx) => {
    if (!row || idx >= row.length) return ''
    var val = row[idx]
    if (val === undefined || val === null) return ''
    return String(val).trim()
  }

  var dataRows = []
  for (var i = 1; i < values.length; i++) {
    var row = values[i]
    var isEmpty = true
    for (var c = 0; c < Math.min(row.length, 10); c++) {
      if (cellStr(row, c)) {
        isEmpty = false
        break
      }
    }
    if (isEmpty) continue

    dataRows.push({
      data_servico: cellStr(row, 0),
      especialista: cellStr(row, 1),
      tipo_video: cellStr(row, 2),
      identificacao: cellStr(row, 3),
      video_bruto: cellStr(row, 4),
      video_editado: cellStr(row, 5),
      valores: cellStr(row, 6),
      observacoes: cellStr(row, 7),
      editor: cellStr(row, 8),
      mes_faturamento: cellStr(row, 9),
    })
  }

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

  $app.logger().info('sync_google_sheets: clearing existing servicos records')
  var deleteOffset = 0
  while (true) {
    var batch
    try {
      batch = $app.findRecordsByFilter('servicos', "id != ''", 'created', 500, deleteOffset)
    } catch (_) {
      break
    }
    if (batch.length === 0) break
    for (var di = 0; di < batch.length; di++) {
      try {
        $app.delete(batch[di])
      } catch (_) {}
    }
    if (batch.length < 500) break
  }
  $app.logger().info('sync_google_sheets: collection cleared')

  let saved = 0
  let errorCount = 0

  try {
    for (let i = 0; i < totalRecords; i += BATCH_SIZE) {
      const batchEnd = Math.min(i + BATCH_SIZE, totalRecords)

      for (let j = i; j < batchEnd; j += TX_SIZE) {
        const txEnd = Math.min(j + TX_SIZE, batchEnd)

        $app.runInTransaction((txApp) => {
          for (let k = j; k < txEnd; k++) {
            try {
              const d = dedupedRows[k]
              const record = new Record(col)

              record.set('data_servico', parseDate(d['data_servico']))
              record.set('especialista', d['especialista'] || '')
              record.set('tipo_video', d['tipo_video'] || '')
              record.set('identificacao', d['identificacao'] || '')
              record.set('video_bruto', d['video_bruto'] || '')
              record.set('video_editado', d['video_editado'] || '')
              record.set('valores', parseValores(d['valores']))
              record.set('observacoes', d['observacoes'] || '')
              record.set('editor', d['editor'] || '')
              record.set('mes_faturamento', d['mes_faturamento'] || '')

              txApp.saveNoValidate(record)
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
    $app.logger().error('sync_google_sheets: import failed', 'error', String(err))
    logSync('error', totalRecords, saved, 'Import failed: ' + String(err))
  }
})
