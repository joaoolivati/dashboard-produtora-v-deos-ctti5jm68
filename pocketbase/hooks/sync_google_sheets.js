cronAdd('sync_google_sheets', '0 6 * * *', () => {
  var SPREADSHEET_ID = '1buDNmxDKscXwe7iGNSwYEAVcm7646dsPpMHTSPyYg-I'
  var RANGE = 'BASE_GERAL'
  var API_KEY = $secrets.get('GOOGLE_API_KEY')
  var API_URL =
    'https://sheets.googleapis.com/v4/spreadsheets/' +
    SPREADSHEET_ID +
    '/values/' +
    RANGE +
    '?key=' +
    API_KEY

  $app.logger().info('sync_google_sheets: iniciando sincronizacao')

  if (!API_KEY) {
    $app.logger().error('sync_google_sheets: GOOGLE_API_KEY nao configurado')
    return
  }

  var syncHistoryCol = null
  try {
    syncHistoryCol = $app.findCollectionByNameOrId('sync_history')
  } catch (_) {}

  var logSync = (status, rowsRead, rowsSaved, errorLog) => {
    if (!syncHistoryCol) return
    try {
      var r = new Record(syncHistoryCol)
      r.set('status', status)
      r.set('rows_read', rowsRead)
      r.set('rows_saved', rowsSaved)
      r.set('error_log', errorLog || '')
      $app.saveNoValidate(r)
    } catch (err) {
      $app.logger().error('sync_google_sheets: erro ao registrar historico: ' + String(err))
    }
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

  var res
  try {
    res = $http.send({
      url: API_URL,
      method: 'GET',
      timeout: 120,
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    $app.logger().error('sync_google_sheets: falha na requisicao HTTP: ' + String(err))
    logSync('error', 0, 0, 'Falha na requisicao HTTP: ' + String(err))
    return
  }

  if (res.statusCode !== 200) {
    var errMsg = 'Google Sheets API retornou status ' + res.statusCode
    if (res.json && res.json.error && res.json.error.message) errMsg = res.json.error.message
    logSync('error', 0, 0, errMsg)
    return
  }

  var responseBody = res.json
  if (!responseBody && typeof res.body === 'string') {
    try {
      responseBody = JSON.parse(res.body)
    } catch (parseErr) {
      logSync('error', 0, 0, 'Erro ao parsear JSON: ' + String(parseErr))
      return
    }
  }

  if (!responseBody || !Array.isArray(responseBody.values)) {
    logSync('error', 0, 0, 'Resposta da API nao contem array de valores')
    return
  }

  var values = responseBody.values
  if (values.length < 2) {
    logSync('error', 0, 0, 'Nenhuma linha de dados encontrada')
    return
  }

  var headerRow = values[0]
  var idServicoIdx = -1
  for (var h = 0; h < headerRow.length; h++) {
    if (String(headerRow[h] || '').trim() === 'ID_SERVICO') {
      idServicoIdx = h
      break
    }
  }
  if (idServicoIdx < 0) {
    logSync('error', 0, 0, 'Coluna ID_SERVICO nao encontrada no cabecalho')
    return
  }

  var col
  try {
    col = $app.findCollectionByNameOrId('servicos')
  } catch (err) {
    logSync('error', 0, 0, 'Colecao servicos nao encontrada: ' + String(err))
    return
  }

  var existingMap = {}
  var loadOffset = 0
  while (true) {
    var batch = $app.findRecordsByFilter('servicos', "id != ''", 'created', 500, loadOffset)
    if (batch.length === 0) break
    for (var b = 0; b < batch.length; b++) {
      var idServ = batch[b].getString('id_servico') || ''
      if (idServ) existingMap[idServ] = batch[b]
    }
    if (batch.length < 500) break
    loadOffset += 500
  }

  var created = 0
  var updated = 0
  var skippedCount = 0
  var monthStats = {}
  var dedupedMap = {}

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

    var exiId = cellStr(row, idServicoIdx)
    var identificacao = cellStr(row, 3)
    var mes = cellStr(row, 9) || 'sem_mes'

    if (!monthStats[mes]) {
      monthStats[mes] = { lidas: 0, criados: 0, atualizados: 0, ignoradas: 0, somaValores: 0 }
    }
    monthStats[mes].lidas++

    if (!exiId) {
      skippedCount++
      monthStats[mes].ignoradas++
      $app
        .logger()
        .info(
          'sync_google_sheets: pulado: sem ID_SERVICO - ' +
            (identificacao || '(sem identificacao)'),
        )
      continue
    }

    var valoresRaw = cellStr(row, 6)
    monthStats[mes].somaValores += parseValores(valoresRaw)

    if (dedupedMap[exiId]) continue
    dedupedMap[exiId] = true

    try {
      var existing = existingMap[exiId]
      if (existing) {
        existing.set('data_servico', parseDate(cellStr(row, 0)))
        existing.set('especialista', cellStr(row, 1))
        existing.set('tipo_video', cellStr(row, 2))
        existing.set('identificacao', identificacao)
        existing.set('video_bruto', cellStr(row, 4))
        existing.set('video_editado', cellStr(row, 5))
        existing.set('valores', parseValores(valoresRaw))
        existing.set('observacoes', cellStr(row, 7))
        existing.set('editor', cellStr(row, 8))
        existing.set('mes_faturamento', cellStr(row, 9))
        existing.set('id_servico', exiId)
        $app.saveNoValidate(existing)
        updated++
        monthStats[mes].atualizados++
      } else {
        var record = new Record(col)
        record.set('data_servico', parseDate(cellStr(row, 0)))
        record.set('especialista', cellStr(row, 1))
        record.set('tipo_video', cellStr(row, 2))
        record.set('identificacao', identificacao)
        record.set('video_bruto', cellStr(row, 4))
        record.set('video_editado', cellStr(row, 5))
        record.set('valores', parseValores(valoresRaw))
        record.set('observacoes', cellStr(row, 7))
        record.set('editor', cellStr(row, 8))
        record.set('mes_faturamento', cellStr(row, 9))
        record.set('id_servico', exiId)
        $app.saveNoValidate(record)
        created++
        monthStats[mes].criados++
        existingMap[exiId] = record
      }
    } catch (recordErr) {
      skippedCount++
      $app
        .logger()
        .error('sync_google_sheets: erro ao processar linha ' + i + ': ' + String(recordErr))
    }
  }

  for (var mesKey in monthStats) {
    var s = monthStats[mesKey]
    $app
      .logger()
      .info(
        'sync_google_sheets: resumo mensal - mes: ' +
          mesKey +
          ' | linhas lidas: ' +
          s.lidas +
          ' | criados: ' +
          s.criados +
          ' | atualizados: ' +
          s.atualizados +
          ' | ignorados (sem ID_SERVICO): ' +
          s.ignoradas +
          ' | soma valores: R$ ' +
          s.somaValores.toFixed(2).replace('.', ','),
      )
  }

  var totalRead = created + updated + skippedCount
  var summary =
    'Linhas lidas: ' +
    totalRead +
    ' | Criados: ' +
    created +
    ' | Atualizados: ' +
    updated +
    ' | Ignorados: ' +
    skippedCount
  logSync('success', totalRead, created + updated, summary)
  $app
    .logger()
    .info(
      'sync_google_sheets: sincronizacao concluida - criados: ' +
        created +
        ', atualizados: ' +
        updated +
        ', ignorados: ' +
        skippedCount,
    )
})
