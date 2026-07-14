cronAdd('sync_google_sheets', '0 * * * *', () => {
  const CSV_URL =
    'https://docs.google.com/spreadsheets/d/1buDNmxDKscXwe7iGNSwYEAVcm7646dsPpMHTSPyYg-I/export?format=csv&gid=0'

  $app.logger().info('sync_google_sheets: starting hourly sync')

  // --- 1. Fetch CSV from Google Sheets (BASE_GERAL tab) ---
  let res
  try {
    res = $http.send({
      url: CSV_URL,
      method: 'GET',
      timeout: 30,
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

  // --- 2. Decode response body ---
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

  // --- 3. Parse CSV (handles quoted fields, embedded commas, newlines) ---
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
    $app.logger().warn('sync_google_sheets: CSV has no data rows, skipping sync')
    return
  }

  // --- 4. Map CSV headers to internal collection field names ---
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

  // --- 5. Resolve servicos collection ---
  let col
  try {
    col = $app.findCollectionByNameOrId('servicos')
  } catch (err) {
    $app.logger().error('sync_google_sheets: servicos collection not found', 'error', String(err))
    return
  }

  // --- 6. Clean-and-reload: delete all + bulk insert in a single transaction ---
  // Runs with superuser privileges (cron hooks have unrestricted access).
  // A single transaction ensures atomicity — if insertion fails, the
  // deletion is rolled back and the previous data set is retained.
  try {
    $app.runInTransaction((txApp) => {
      // --- 6a. Delete all existing records ---
      // Raw SQL DELETE is far faster than iterating records for 10K+ rows.
      let previousCount = 0
      try {
        // Count existing before delete for logging
        const existingCheck = txApp.findRecordsByFilter('servicos', "id != ''", '-created', 1, 0)
        if (existingCheck.length > 0) {
          // Use countRecords for an accurate number
          previousCount = txApp.countRecords('servicos')
        }
        // Fast bulk delete via raw SQL
        txApp.db().newQuery('DELETE FROM servicos').execute()
      } catch (_) {
        // Fallback: batch delete via findRecordsByFilter (500 per batch)
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

      // --- 6b. Bulk insert all parsed records ---
      // saveNoValidate skips field validation for maximum throughput.
      // All writes are buffered by the transaction and committed atomically.
      let inserted = 0

      for (let i = 0; i < totalRecords; i++) {
        const d = dataRows[i]
        const record = new Record(col)

        // Parse data_servico: supports DD/MM/YYYY and YYYY-MM-DD
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

        // Parse valores: handles BR (1.234,56) and US (1,234.56) decimal formats
        let rawVal = (d['valores'] || '0').toString()
        rawVal = rawVal.replace(/[^0-9.,-]/g, '')
        if (rawVal.indexOf(',') > -1 && rawVal.indexOf('.') > -1) {
          rawVal = rawVal.replace(/\./g, '').replace(',', '.')
        } else if (rawVal.indexOf(',') > -1) {
          rawVal = rawVal.replace(',', '.')
        }
        let valores = parseFloat(rawVal)
        if (isNaN(valores)) valores = 0

        // Map all CSV fields to servicos collection schema
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

        // Log progress every 5000 records for monitoring large syncs
        if (inserted % 5000 === 0 && inserted < totalRecords) {
          $app
            .logger()
            .info(
              'sync_google_sheets: bulk insert progress',
              'inserted',
              inserted,
              'total',
              totalRecords,
            )
        }
      }

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
