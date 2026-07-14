routerAdd(
  'POST',
  '/backend/v1/sync-pull-sheets',
  (e) => {
    const CSV_URL =
      'https://docs.google.com/spreadsheets/d/1buDNmxDKscXwe7iGNSwYEAVcm7646dsPpMHTSPyYg-I/gviz/tq?tqx=out:csv&sheet=BASE_GERAL'

    $app.logger().info('sync_pull_sheets: manual sync triggered')

    let res
    try {
      res = $http.send({
        url: CSV_URL,
        method: 'GET',
        timeout: 30,
      })
    } catch (err) {
      $app.logger().error('sync_pull_sheets: HTTP request failed', 'error', String(err))
      return e.json(500, { error: 'Failed to fetch Google Sheets data', detail: String(err) })
    }

    if (res.statusCode !== 200) {
      $app.logger().error('sync_pull_sheets: non-200 response', 'statusCode', res.statusCode)
      return e.json(502, { error: 'Google Sheets returned non-200', statusCode: res.statusCode })
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
      return e.json(500, { error: 'Failed to decode response' })
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
      return e.json(200, { message: 'No data rows found in CSV', inserted: 0 })
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
      return e.json(500, { error: 'servicos collection not found' })
    }

    try {
      let inserted = 0

      $app.runInTransaction((txApp) => {
        let previousCount = 0
        try {
          previousCount = txApp.countRecords('servicos')
          txApp.db().newQuery('DELETE FROM servicos').execute()
        } catch (_) {
          while (true) {
            const existing = txApp.findRecordsByFilter('servicos', "id != ''", '-created', 500, 0)
            if (existing.length === 0) break
            previousCount += existing.length
            for (let i = 0; i < existing.length; i++) {
              txApp.delete(existing[i])
            }
          }
        }

        $app.logger().info('sync_pull_sheets: deleted existing', 'previousCount', previousCount)

        for (let i = 0; i < totalRecords; i++) {
          const d = dataRows[i]
          const record = new Record(col)

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
          if (!dataServico) {
            dataServico = new Date().toISOString().slice(0, 10)
          }

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
          record.set('identificacao', d['identificacao'] || '')
          record.set('video_bruto', d['video_bruto'] || '')
          record.set('video_editado', d['video_editado'] || '')
          record.set('valores', valores)
          record.set('observacoes', d['observacoes'] || '')
          record.set('editor', d['editor'] || '')
          record.set('mes_faturamento', d['mes_faturamento'] || '')

          txApp.saveNoValidate(record)
          inserted++
        }

        $app
          .logger()
          .info('sync_pull_sheets: sync completed', 'inserted', inserted, 'total', totalRecords)
      })

      return e.json(200, {
        message: 'Sync completed successfully',
        inserted,
        totalParsed: totalRecords,
      })
    } catch (err) {
      $app.logger().error('sync_pull_sheets: transaction failed', 'error', String(err))
      return e.json(500, {
        error: 'Sync transaction failed, previous data retained',
        detail: String(err),
      })
    }
  },
  $apis.requireAuth(),
)
