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

  $app.logger().info('sync_google_sheets: iniciando sincronização agendada')

  if (!API_KEY) {
    $app.logger().error('sync_google_sheets: GOOGLE_API_KEY não configurado')
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
      $app.logger().error('sync_google_sheets: erro ao registrar histórico', 'error', String(err))
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
    $app.logger().error('sync_google_sheets: falha na requisição HTTP', 'error', String(err))
    logSync('error', 0, 0, 'Falha na requisição HTTP: ' + String(err))
    return
  }

  if (res.statusCode !== 200) {
    $app.logger().error('sync_google_sheets: resposta não-200', 'statusCode', res.statusCode)
    let errMsg = 'Google Sheets API retornou status ' + res.statusCode
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
      logSync('error', 0, 0, 'Erro ao parsear JSON: ' + String(parseErr))
      return
    }
  }

  if (!responseBody || !Array.isArray(responseBody.values)) {
    logSync('error', 0, 0, 'Resposta da API não contém array de valores')
    return
  }

  const values = responseBody.values
  $app.logger().info('sync_google_sheets: valores recebidos', 'totalRows', values.length)

  if (values.length < 2) {
    logSync('error', 0, 0, 'Nenhuma linha de dados encontrada — necessário ao menos 2 linhas')
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

  var normalizeKey = (raw) => {
    return (raw || '').toString().trim().toLowerCase().replace(/\s+/g, ' ')
  }

  var normalizeValor = (raw) => {
    if (typeof raw === 'number') return String(raw)
    var v = (raw || '0').toString().trim()
    v = v
      .replace(/R\$/gi, '')
      .replace(/\s/g, '')
      .replace(/[^\d.,-]/g, '')
    if (!v) return '0'
    if (v.indexOf(',') > -1 && v.indexOf('.') > -1) {
      v = v.replace(/\./g, '').replace(',', '.')
    } else if (v.indexOf(',') > -1) {
      v = v.replace(',', '.')
    }
    var n = parseFloat(v)
    return isNaN(n) ? '0' : String(n)
  }

  var buildImportKey = (d) => {
    var parts = [
      normalizeKey(d.mes_faturamento),
      normalizeKey(parseDate(d.data_servico)),
      normalizeKey(d.especialista),
      normalizeKey(d.tipo_video),
      normalizeKey(d.identificacao),
      normalizeValor(d.valores),
    ]
    return parts.join('|')
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
    const key = buildImportKey(dataRows[i])
    dataRows[i]._importKey = key
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
      'sync_google_sheets: registros deduplicados',
      'totalRecords',
      totalRecords,
      'originalRows',
      dataRows.length,
    )

  let col
  try {
    col = $app.findCollectionByNameOrId('servicos')
  } catch (err) {
    logSync('error', totalRecords, 0, 'Coleção servicos não encontrada: ' + String(err))
    return
  }

  var existingMap = {}
  try {
    var loadOffset = 0
    while (true) {
      var batch = $app.findRecordsByFilter('servicos', "id != ''", 'created', 500, loadOffset)
      if (batch.length === 0) break
      for (var b = 0; b < batch.length; b++) {
        var key = batch[b].getString('importKey') || ''
        if (key) {
          existingMap[key] = batch[b]
        }
      }
      if (batch.length < 500) break
      loadOffset += 500
    }
  } catch (err) {
    $app
      .logger()
      .warn('sync_google_sheets: erro ao carregar registros existentes', 'error', String(err))
  }

  let created = 0
  let updated = 0
  let skipped = 0
  var skipReasons = []

  try {
    for (let i = 0; i < totalRecords; i++) {
      try {
        const d = dedupedRows[i]
        const key = d._importKey
        var existing = existingMap[key]

        if (existing) {
          existing.set('data_servico', parseDate(d.data_servico))
          existing.set('especialista', d.especialista || '')
          existing.set('tipo_video', d.tipo_video || '')
          existing.set('identificacao', d.identificacao || '')
          existing.set('video_bruto', d.video_bruto || '')
          existing.set('video_editado', d.video_editado || '')
          existing.set('valores', parseValores(d.valores))
          existing.set('observacoes', d.observacoes || '')
          existing.set('editor', d.editor || '')
          existing.set('mes_faturamento', d.mes_faturamento || '')
          existing.set('importKey', key)
          $app.saveNoValidate(existing)
          updated++
        } else {
          var record = new Record(col)
          record.set('data_servico', parseDate(d.data_servico))
          record.set('especialista', d.especialista || '')
          record.set('tipo_video', d.tipo_video || '')
          record.set('identificacao', d.identificacao || '')
          record.set('video_bruto', d.video_bruto || '')
          record.set('video_editado', d.video_editado || '')
          record.set('valores', parseValores(d.valores))
          record.set('observacoes', d.observacoes || '')
          record.set('editor', d.editor || '')
          record.set('mes_faturamento', d.mes_faturamento || '')
          record.set('importKey', key)
          $app.saveNoValidate(record)
          created++
          existingMap[key] = record
        }
      } catch (recordErr) {
        skipped++
        if (skipReasons.length < 10) {
          skipReasons.push('Registro ' + i + ': ' + String(recordErr))
        }
      }
    }

    var summary =
      'Linhas lidas: ' +
      totalRecords +
      ' | Criados: ' +
      created +
      ' | Atualizados: ' +
      updated +
      ' | Ignorados: ' +
      skipped +
      (skipReasons.length > 0 ? ' | Motivos: ' + skipReasons.join('; ') : '')

    logSync('success', totalRecords, created + updated, summary)
    $app
      .logger()
      .info(
        'sync_google_sheets: sincronização concluída',
        'created',
        created,
        'updated',
        updated,
        'skipped',
        skipped,
        'total',
        totalRecords,
      )
  } catch (err) {
    $app.logger().error('sync_google_sheets: falha na importação', 'error', String(err))
    logSync('error', totalRecords, created + updated, 'Falha na importação: ' + String(err))
  }
})
