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

  var stripAccents = (str) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ñ/g, 'n')
  }

  var FIELD_ALIASES = {
    data_servico: ['data_servico', 'data_do_servico', 'data', 'data_servico'],
    especialista: ['especialista', 'especialista_responsavel', 'responsavel'],
    tipo_video: [
      'tipo_video',
      'tipo_de_video',
      'tipo_de_servico',
      'tipo_servico',
      'tipo',
      'servico',
    ],
    identificacao: ['identificacao', 'identificacao_do_video', 'id_video', 'codigo'],
    video_bruto: ['video_bruto', 'tempo_bruto', 'duracao_bruta', 'bruto'],
    video_editado: ['video_editado', 'tempo_editado', 'duracao_editada', 'editado'],
    valores: ['valores', 'valor', 'preco', 'custo', 'valor_servico'],
    observacoes: ['observacoes', 'observacao', 'obs', 'notas', 'nota'],
    editor: ['editor', 'editor_responsavel', 'responsavel_edicao'],
    mes_faturamento: ['mes_faturamento', 'mes_de_faturamento', 'faturamento', 'mes'],
  }

  var aliasToField = {}
  Object.keys(FIELD_ALIASES).forEach(function (field) {
    aliasToField[field] = field
    FIELD_ALIASES[field].forEach(function (alias) {
      aliasToField[alias] = field
    })
  })

  var normalizeHeader = (rawHeader) => {
    var normalized = stripAccents(String(rawHeader || ''))
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
    return aliasToField[normalized] || normalized
  }

  var headers = values[0].map(normalizeHeader)

  $app.logger().info('sync_google_sheets: normalized headers', 'headers', JSON.stringify(headers))

  var REQUIRED_FIELDS = [
    'data_servico',
    'especialista',
    'tipo_video',
    'identificacao',
    'video_bruto',
    'video_editado',
    'valores',
    'observacoes',
    'editor',
    'mes_faturamento',
  ]

  var missingFields = REQUIRED_FIELDS.filter(function (f) {
    return headers.indexOf(f) === -1
  })
  if (missingFields.length > 0) {
    $app
      .logger()
      .warn(
        'sync_google_sheets: some fields not found in spreadsheet headers',
        'missingFields',
        JSON.stringify(missingFields),
        'headersFound',
        JSON.stringify(headers),
      )
  }

  var dataRows = values.slice(1).map((row) => {
    var obj = {}
    headers.forEach((h, i) => {
      obj[h] = row[i] !== undefined ? String(row[i]) : ''
    })
    REQUIRED_FIELDS.forEach(function (f) {
      if (!(f in obj)) obj[f] = ''
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
    var d = (raw || '').toString().trim()
    if (!d) return new Date().toISOString().slice(0, 10)

    var parts = d.split(/[\/\-]/)
    if (parts.length === 3) {
      var day = parts[0].padStart(2, '0')
      var month = parts[1].padStart(2, '0')
      var year = parts[2]
      if (year.length === 2) year = '20' + year
      return year + '-' + month + '-' + day
    }

    var parsed = new Date(d)
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10)
    }

    return new Date().toISOString().slice(0, 10)
  }

  const parseValores = (raw) => {
    if (typeof raw === 'number') return raw
    var v = (raw || '0').toString().trim()
    v = v.replace(/R\$/gi, '').replace(/[^\d.,-]/g, '')
    if (!v) return 0
    if (v.indexOf(',') > -1 && v.indexOf('.') > -1) {
      v = v.replace(/\./g, '').replace(',', '.')
    } else if (v.indexOf(',') > -1) {
      v = v.replace(',', '.')
    }
    var n = parseFloat(v)
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
