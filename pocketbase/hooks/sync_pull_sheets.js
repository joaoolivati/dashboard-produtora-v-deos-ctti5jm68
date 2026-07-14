routerAdd(
  'POST',
  '/backend/v1/sync-pull-sheets',
  (e) => {
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
    const HTTP_TIMEOUT = 300
    const BATCH_SIZE = 1000

    $app.logger().info('sync_pull_sheets: manual sync triggered')

    if (!API_KEY) {
      $app.logger().error('sync_pull_sheets: GOOGLE_API_KEY secret is not set')
      return e.json(500, { error: 'GOOGLE_API_KEY secret is not configured', status: 'error' })
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
        $app.logger().error('sync_pull_sheets: failed to log sync history', 'error', String(err))
      }
    }

    let res
    try {
      res = $http.send({
        url: API_URL,
        method: 'GET',
        timeout: HTTP_TIMEOUT,
        headers: {
          Accept: 'application/json',
        },
      })
    } catch (err) {
      $app.logger().error('sync_pull_sheets: HTTP request failed', 'error', String(err))
      logSync('error', 0, 0, 'HTTP request failed: ' + String(err))
      return e.json(500, { error: 'Failed to fetch Google Sheets data', status: 'error' })
    }

    if (res.statusCode !== 200) {
      $app.logger().error('sync_pull_sheets: non-200 response', 'statusCode', res.statusCode)
      let errMsg = 'Google Sheets API returned status ' + res.statusCode
      if (res.json && res.json.error && res.json.error.message) {
        errMsg = res.json.error.message
      }
      logSync('error', 0, 0, errMsg)
      return e.json(502, {
        error: errMsg,
        statusCode: res.statusCode,
        status: 'error',
      })
    }

    let responseBody = res.json
    if (!responseBody && typeof res.body === 'string') {
      try {
        responseBody = JSON.parse(res.body)
      } catch (parseErr) {
        $app.logger().error('sync_pull_sheets: JSON parse failed', 'error', String(parseErr))
        logSync('error', 0, 0, 'Failed to parse JSON response: ' + String(parseErr))
        return e.json(502, { error: 'Failed to parse Google Sheets API response', status: 'error' })
      }
    }

    if (!responseBody || !Array.isArray(responseBody.values)) {
      $app.logger().error('sync_pull_sheets: values array not found in response')
      logSync('error', 0, 0, 'Google Sheets API response did not contain a values array')
      return e.json(502, { error: 'No values array in Google Sheets response', status: 'error' })
    }

    const values = responseBody.values
    $app.logger().info('sync_pull_sheets: received values from API', 'totalRows', values.length)

    if (values.length < 2) {
      $app
        .logger()
        .warn('sync_pull_sheets: no data rows (need at least 2 rows)', 'totalRows', values.length)
      logSync(
        'error',
        0,
        0,
        'No data rows found — need at least 2 rows (got ' + values.length + ')',
      )
      return e.json(200, {
        message: 'No data rows found in spreadsheet',
        rowsRead: 0,
        rowsSaved: 0,
        status: 'success',
      })
    }

    const headers = values[0].map((h) => {
      return String(h || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
    })
    $app.logger().info('sync_pull_sheets: headers detected', 'headers', headers.join(', '))

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
    const dedupedRows = []
    for (let k = 0; k < dedupedKeys.length; k++) {
      dedupedRows.push(dedupedMap[dedupedKeys[k]])
    }

    const totalRecords = dedupedRows.length
    $app
      .logger()
      .info(
        'sync_pull_sheets: deduped records',
        'totalRecords',
        totalRecords,
        'originalRows',
        dataRows.length,
      )

    let col
    try {
      col = $app.findCollectionByNameOrId('servicos')
    } catch (err) {
      $app.logger().error('sync_pull_sheets: servicos collection not found', 'error', String(err))
      logSync('error', totalRecords, 0, 'servicos collection not found: ' + String(err))
      return e.json(500, { error: 'servicos collection not found', status: 'error' })
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
        'sync_pull_sheets: built existing map',
        'existingCount',
        Object.keys(existingMap).length,
      )

    let saved = 0
    let errorCount = 0

    try {
      for (let i = 0; i < totalRecords; i++) {
        $app.runInTransaction((txApp) => {
          const batchEnd = Math.min(i + BATCH_SIZE, totalRecords)
          for (let j = i; j < batchEnd; j++) {
            try {
              const d = dedupedRows[j]
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

              let dataServico = d['data_servico'] || ''
              if (dataServico) {
                const slashParts = dataServico.split('/')
                if (slashParts.length === 3) {
                  let day = slashParts[0]
                  let month = slashParts[1]
                  const year = slashParts[2]
                  if (day.length < 2) day = '0' + day
                  if (month.length < 2) month = '0' + month
                  dataServico = year + '-' + month + '-' + day
                }
              }
              if (!dataServico) dataServico = new Date().toISOString().slice(0, 10)

              let rawVal = (d['valores'] || '0').toString()
              rawVal = rawVal.replace(/[^0-9.,-]/g, '')
              if (rawVal.indexOf(',') > -1 && rawVal.indexOf('.') > -1) {
                rawVal = rawVal.replace(/\./g, '').replace(',', '.')
              } else if (rawVal.indexOf(',') > -1) {
                rawVal = rawVal.replace(',', '.')
              }
              let valores = parseFloat(rawVal)
              if (isNaN(valores)) valores = 0

              record.set('identificacao', ident)
              record.set('data_servico', dataServico)
              record.set('valores', valores)
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
                  .warn('sync_pull_sheets: skipped record', 'index', j, 'error', String(recordErr))
              }
            }
          }
        })

        i += BATCH_SIZE - 1

        if ((i + 1) % 1000 === 0 || i + 1 >= totalRecords) {
          $app
            .logger()
            .info(
              'sync_pull_sheets: progress',
              'processed',
              Math.min(i + 1, totalRecords),
              'of',
              totalRecords,
              'saved',
              saved,
              'errors',
              errorCount,
            )
        }
      }

      const errorLog = errorCount > 0 ? errorCount + ' records skipped due to errors' : ''
      logSync('success', totalRecords, saved, errorLog)
      $app
        .logger()
        .info(
          'sync_pull_sheets: sync completed',
          'saved',
          saved,
          'total',
          totalRecords,
          'errors',
          errorCount,
        )

      return e.json(200, {
        message: 'Sync completed successfully',
        rowsRead: totalRecords,
        rowsSaved: saved,
        status: 'success',
      })
    } catch (err) {
      $app.logger().error('sync_pull_sheets: upsert failed', 'error', String(err))
      logSync('error', totalRecords, saved, 'Upsert failed: ' + String(err))
      return e.json(500, {
        error: 'Sync failed, partial data may exist',
        rowsRead: totalRecords,
        rowsSaved: saved,
        status: 'error',
      })
    }
  },
  $apis.requireAuth(),
)
