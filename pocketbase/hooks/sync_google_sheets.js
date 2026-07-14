cronAdd('sync_google_sheets', '0 * * * *', () => {
  const CSV_URL =
    'https://docs.google.com/spreadsheets/d/1buDNmxDKscXwe7iGNSwYEAVcm7646dsPpMHTSPyYg-I/gviz/tq?tqx=out:csv&sheet=BASE_GERAL'

  const BATCH_SIZE = 1000
  const HTTP_TIMEOUT = 120

  $app.logger().info('sync_google_sheets: starting hourly sync')

  let res
  try {
    res = $http.send({
      url: CSV_URL,
      method: 'GET',
      timeout: HTTP_TIMEOUT,
    })
  } catch (err) {
    $app.logger().error('sync_google_sheets: HTTP request failed', 'error', String(err))
    return
  }

  if (res.statusCode !== 200) {
    $app
      .logger()
      .error(
        'sync_google_sheets: non-200 response from Google Sheets',
        'statusCode',
        res.statusCode,
      )
    return
  }

  let csvText = ''
  try {
    if (typeof res.body === 'string') {
      csvText = res.body
    } else {
      csvText = new TextDecoder().decode(res.body)
    }
  } catch (err) {
    $app.logger().error('sync_google_sheets: failed to decode response body', 'error', String(err))
    return
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

  console.log('Total lines read from Google Sheets CSV: ' + (rows.length - 1))
  $app.logger().info('sync_google_sheets: CSV parsed', 'totalLines', rows.length - 1)

  if (rows.length < 2) {
    $app.logger().warn('sync_google_sheets: CSV has no data rows, skipping sync')
    return
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
  $app.logger().info('sync_google_sheets: parsed CSV data', 'totalRecords', totalRecords)

  let col
  try {
    col = $app.findCollectionByNameOrId('servicos')
  } catch (err) {
    $app.logger().error('sync_google_sheets: servicos collection not found', 'error', String(err))
    return
  }

  try {
    let inserted = 0

    $app.runInTransaction((txApp) => {
      let previousCount = 0
      try {
        previousCount = txApp.countRecords('servicos')
        txApp.db().newQuery('DELETE FROM servicos').execute()
      } catch (_) {
        previousCount = 0
        while (true) {
          const existing = txApp.findRecordsByFilter('servicos', "id != ''", '-created', 500, 0)
          if (existing.length === 0) break
          previousCount += existing.length
          for (let i = 0; i < existing.length; i++) {
            txApp.delete(existing[i])
          }
        }
      }

      $app
        .logger()
        .info('sync_google_sheets: deleted existing records', 'previousCount', previousCount)

      const totalBatches = Math.ceil(totalRecords / BATCH_SIZE)

      for (let b = 0; b < totalBatches; b++) {
        const batchStart = b * BATCH_SIZE
        const batchEnd = Math.min(batchStart + BATCH_SIZE, totalRecords)

        for (let i = batchStart; i < batchEnd; i++) {
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
          .info(
            'sync_google_sheets: batch completed',
            'batch',
            b + 1,
            'of',
            totalBatches,
            'inserted',
            inserted,
            'total',
            totalRecords,
          )
      }

      console.log('Total records successfully written to PocketBase (servicos): ' + inserted)
      $app
        .logger()
        .info(
          'sync_google_sheets: sync completed successfully',
          'recordsInserted',
          inserted,
          'totalParsed',
          totalRecords,
        )
    })
  } catch (err) {
    $app
      .logger()
      .error('sync_google_sheets: transaction failed, previous data retained', 'error', String(err))
  }
})
