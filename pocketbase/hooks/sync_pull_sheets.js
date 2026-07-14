routerAdd(
  'POST',
  '/backend/v1/sync-pull-sheets',
  (e) => {
    const CSV_URL =
      'https://docs.google.com/spreadsheets/d/1buDNmxDKscXwe7iGNSwYEAVcm7646dsPpMHTSPyYg-I/gviz/tq?tqx=out:csv&sheet=BASE_GERAL'
    const HTTP_TIMEOUT = 300

    $app.logger().info('sync_pull_sheets: manual sync triggered')

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
        url: CSV_URL,
        method: 'GET',
        timeout: HTTP_TIMEOUT,
        headers: {
          Accept: 'text/csv, text/plain, */*',
          'Accept-Encoding': 'identity',
        },
      })
    } catch (err) {
      $app.logger().error('sync_pull_sheets: HTTP request failed', 'error', String(err))
      logSync('error', 0, 0, 'HTTP request failed: ' + String(err))
      return e.json(500, { error: 'Failed to fetch Google Sheets data', status: 'error' })
    }

    if (res.statusCode !== 200) {
      $app.logger().error('sync_pull_sheets: non-200 response', 'statusCode', res.statusCode)
      logSync('error', 0, 0, 'Google Sheets returned status ' + res.statusCode)
      return e.json(502, {
        error: 'Google Sheets returned non-200',
        statusCode: res.statusCode,
        status: 'error',
      })
    }

    let csvText = ''
    if (!res.body) {
      logSync('error', 0, 0, 'Empty response body from Google Sheets')
      return e.json(502, { error: 'Empty response from Google Sheets', status: 'error' })
    }
    // Process body directly as string — TextDecoder is unavailable in the JSVM
    if (typeof res.body === 'string') {
      csvText = res.body
    } else if (res.body && typeof res.body.toString === 'function') {
      csvText = res.body.toString()
    } else {
      csvText = String(res.body)
    }
    // Strip UTF-8 BOM (causes first header name mismatch) and null bytes
    csvText = csvText.replace(/^\uFEFF/, '').replace(/\u0000/g, '')

    $app.logger().info('sync_pull_sheets: received CSV payload', 'csvTextLength', csvText.length)
    $app
      .logger()
      .info('sync_pull_sheets: raw CSV first 500 chars', 'preview', csvText.slice(0, 500))

    if (
      csvText.indexOf('<!DOCTYPE') > -1 ||
      csvText.indexOf('<html') > -1 ||
      csvText.indexOf('<HTML') > -1
    ) {
      logSync('error', 0, 0, 'Google Sheets returned HTML instead of CSV')
      return e.json(502, {
        error: 'Google Sheets returned HTML instead of CSV data',
        status: 'error',
      })
    }

    const rows = []
    let row = []
    let currentVal = ''
    let inQuotes = false
    const MAX_FIELD_LENGTH = 100000

    const str = csvText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\u2028/g, '\n')
      .replace(/\u2029/g, '\n')
      .replace(/\u0085/g, '\n')
      .replace(/\u000B/g, '\n')
      .replace(/\u000C/g, '\n')

    for (let i = 0; i < str.length; i++) {
      const char = str[i]
      if (inQuotes) {
        if (currentVal.length > MAX_FIELD_LENGTH) {
          inQuotes = false
          if (char === ',') {
            row.push(currentVal.trim())
            currentVal = ''
          } else if (char === '\n') {
            row.push(currentVal.trim())
            if (row.some((v) => v)) rows.push(row)
            row = []
            currentVal = ''
          } else {
            currentVal += char
          }
        } else if (char === '"') {
          if (str[i + 1] === '"') {
            currentVal += '"'
            i++
          } else {
            inQuotes = false
          }
        } else {
          currentVal += char
        }
      } else {
        if (char === '"') {
          inQuotes = true
        } else if (char === ',') {
          row.push(currentVal.trim())
          currentVal = ''
        } else if (char === '\n') {
          row.push(currentVal.trim())
          if (row.some((v) => v)) rows.push(row)
          row = []
          currentVal = ''
        } else {
          currentVal += char
        }
      }
    }
    row.push(currentVal.trim())
    if (row.some((v) => v)) rows.push(row)
    $app.logger().info('sync_pull_sheets: parsed CSV rows', 'totalLines', rows.length)

    if (rows.length < 2) {
      $app
        .logger()
        .warn(
          'sync_pull_sheets: CSV has no data rows (need at least 2 rows: header + data)',
          'rawLength',
          csvText.length,
          'parsedRows',
          rows.length,
        )
      logSync(
        'error',
        0,
        0,
        'No data rows found in CSV — need at least 2 rows (parsed ' +
          rows.length +
          ' rows from ' +
          csvText.length +
          ' chars)',
      )
      return e.json(200, {
        message: 'No data rows found in CSV — need at least 2 rows',
        rowsRead: 0,
        rowsSaved: 0,
        status: 'success',
      })
    }

    const headers = rows[0].map((h) => h.toLowerCase().trim().replace(/\s+/g, '_'))
    $app.logger().info('sync_pull_sheets: CSV headers detected', 'headers', headers.join(', '))
    const dataRows = rows.slice(1).map((r) => {
      const obj = {}
      headers.forEach((h, i) => {
        obj[h] = r[i] || ''
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
        'sync_pull_sheets: parsed CSV',
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
        try {
          const d = dedupedRows[i]
          const ident = (d['identificacao'] || '').trim()

          let record
          if (ident && existingMap[ident]) {
            try {
              record = $app.findRecordById('servicos', existingMap[ident])
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

          $app.saveNoValidate(record)

          if (ident && record.id) existingMap[ident] = record.id
          saved++
        } catch (recordErr) {
          errorCount++
          if (errorCount <= 10) {
            $app
              .logger()
              .warn('sync_pull_sheets: skipped record', 'index', i, 'error', String(recordErr))
          }
        }

        if ((i + 1) % 500 === 0) {
          $app
            .logger()
            .info(
              'sync_pull_sheets: progress',
              'processed',
              i + 1,
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
