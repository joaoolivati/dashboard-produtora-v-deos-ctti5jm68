routerAdd(
  'POST',
  '/backend/v1/sync-pull-sheets',
  (e) => {
    const CSV_URL =
      'https://docs.google.com/spreadsheets/d/1buDNmxDKscXwe7iGNSwYEAVcm7646dsPpMHTSPyYg-I/gviz/tq?tqx=out:csv&sheet=BASE_GERAL'
    const BATCH_SIZE = 1000
    const HTTP_TIMEOUT = 120

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
      res = $http.send({ url: CSV_URL, method: 'GET', timeout: HTTP_TIMEOUT })
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
    try {
      if (typeof res.body === 'string') {
        csvText = res.body
      } else {
        csvText = new TextDecoder().decode(res.body)
      }
    } catch (err) {
      $app.logger().error('sync_pull_sheets: failed to decode body', 'error', String(err))
      logSync('error', 0, 0, 'Failed to decode response: ' + String(err))
      return e.json(500, { error: 'Failed to decode response', status: 'error' })
    }

    const rows = []
    let row = []
    let currentVal = ''
    let inQuotes = false
    const str = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    for (let i = 0; i < str.length; i++) {
      const char = str[i]
      if (char === '"') {
        if (str[i + 1] === '"') {
          currentVal += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentVal.trim())
        currentVal = ''
      } else if (char === '\n' && !inQuotes) {
        row.push(currentVal.trim())
        if (row.some((v) => v)) rows.push(row)
        row = []
        currentVal = ''
      } else {
        currentVal += char
      }
    }
    row.push(currentVal.trim())
    if (row.some((v) => v)) rows.push(row)

    if (rows.length < 2) {
      $app.logger().warn('sync_pull_sheets: CSV has no data rows')
      logSync('error', 0, 0, 'No data rows found in CSV')
      return e.json(200, {
        message: 'No data rows found in CSV',
        rowsRead: 0,
        rowsSaved: 0,
        status: 'success',
      })
    }

    const headers = rows[0].map((h) => h.toLowerCase().trim().replace(/\s+/g, '_'))
    const dataRows = rows.slice(1).map((r) => {
      const obj = {}
      headers.forEach((h, i) => {
        obj[h] = r[i] || ''
      })
      return obj
    })

    const totalRecords = dataRows.length
    $app.logger().info('sync_pull_sheets: parsed CSV', 'totalRecords', totalRecords)

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
    const totalBatches = Math.ceil(totalRecords / BATCH_SIZE)

    try {
      for (let b = 0; b < totalBatches; b++) {
        const batchStart = b * BATCH_SIZE
        const batchEnd = Math.min(batchStart + BATCH_SIZE, totalRecords)

        $app.runInTransaction((txApp) => {
          for (let i = batchStart; i < batchEnd; i++) {
            const d = dataRows[i]
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

            record.set('data_servico', dataServico)
            record.set('especialista', d['especialista'] || '')
            record.set('tipo_video', d['tipo_video'] || '')
            record.set('identificacao', ident)
            record.set('video_bruto', d['video_bruto'] || '')
            record.set('video_editado', d['video_editado'] || '')
            record.set('valores', valores)
            record.set('observacoes', d['observacoes'] || '')
            record.set('editor', d['editor'] || '')
            record.set('mes_faturamento', d['mes_faturamento'] || '')

            txApp.saveNoValidate(record)

            if (ident && record.id) existingMap[ident] = record.id
            saved++
          }
        })

        $app
          .logger()
          .info(
            'sync_pull_sheets: batch completed',
            'batch',
            b + 1,
            'of',
            totalBatches,
            'saved',
            saved,
          )
      }

      logSync('success', totalRecords, saved, '')
      $app.logger().info('sync_pull_sheets: sync completed', 'saved', saved, 'total', totalRecords)

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
