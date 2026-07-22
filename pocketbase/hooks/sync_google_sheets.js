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

  $app.logger().info('sync_google_sheets: iniciando sincronização')

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
      const r = new Record(syncHistoryCol)
      r.set('status', status)
      r.set('rows_read', rowsRead)
      r.set('rows_saved', rowsSaved)
      r.set('error_log', errorLog || '')
      $app.saveNoValidate(r)
    } catch (err) {
      $app.logger().error('sync_google_sheets: erro ao registrar histórico', 'error', String(err))
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

  var buildOldCompositeKey = (d) => {
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

  var repointDeliveries = (oldServicoId, newServicoId) => {
    try {
      var deliveries = $app.findRecordsByFilter(
        'deliveries',
        "demandId = '" + oldServicoId + "'",
        '',
        100,
        0,
      )
      for (var i = 0; i < deliveries.length; i++) {
        deliveries[i].set('demandId', newServicoId)
        $app.saveNoValidate(deliveries[i])
      }
    } catch (_) {}
  }

  let res
  try {
    res = $http.send({
      url: API_URL,
      method: 'GET',
      timeout: 120,
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    $app.logger().error('sync_google_sheets: falha na requisição HTTP', 'error', String(err))
    logSync('error', 0, 0, 'Falha na requisição HTTP: ' + String(err))
    return
  }

  if (res.statusCode !== 200) {
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
  if (values.length < 2) {
    logSync('error', 0, 0, 'Nenhuma linha de dados encontrada — necessário ao menos 2 linhas')
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
    logSync('error', 0, 0, 'Coluna ID_SERVICO não encontrada no cabeçalho da planilha')
    return
  }

  var dataRows = []
  var skippedNoId = []
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
    if (!exiId) {
      skippedNoId.push({
        identificacao: cellStr(row, 3),
        mes: cellStr(row, 9),
      })
      continue
    }

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
      exiId: exiId,
    })
  }

  var dedupedMap = {}
  var dedupedKeys = []
  for (var i = 0; i < dataRows.length; i++) {
    var key = dataRows[i].exiId
    if (!dedupedMap[key]) dedupedKeys.push(key)
    dedupedMap[key] = dataRows[i]
  }
  var dedupedRows = dedupedKeys.map((k) => dedupedMap[k])
  var totalRecords = dedupedRows.length

  $app
    .logger()
    .info(
      'sync_google_sheets: registros processados',
      'totalRecords',
      totalRecords,
      'skippedNoId',
      skippedNoId.length,
    )

  let col
  try {
    col = $app.findCollectionByNameOrId('servicos')
  } catch (err) {
    logSync('error', totalRecords, 0, 'Coleção servicos não encontrada: ' + String(err))
    return
  }

  var existingByImportKey = {}
  var existingByOldKey = {}
  var needsReconciliation = false
  var duplicatesToDelete = []

  var loadOffset = 0
  while (true) {
    var batch = $app.findRecordsByFilter('servicos', "id != ''", 'created', 500, loadOffset)
    if (batch.length === 0) break
    for (var b = 0; b < batch.length; b++) {
      var rec = batch[b]
      var ik = rec.getString('importKey') || ''
      if (ik && ik.indexOf('|') > -1) {
        needsReconciliation = true
        if (existingByOldKey[ik]) {
          duplicatesToDelete.push({ record: rec, survivorId: existingByOldKey[ik].id })
        } else {
          existingByOldKey[ik] = rec
        }
      } else if (ik) {
        if (existingByImportKey[ik]) {
          duplicatesToDelete.push({ record: rec, survivorId: existingByImportKey[ik].id })
        } else {
          existingByImportKey[ik] = rec
        }
      }
    }
    if (batch.length < 500) break
    loadOffset += 500
  }

  for (var d = 0; d < duplicatesToDelete.length; d++) {
    var dup = duplicatesToDelete[d]
    repointDeliveries(dup.record.id, dup.survivorId)
    try {
      $app.delete(dup.record)
    } catch (_) {}
  }

  var created = 0
  var updated = 0
  var skippedCount = skippedNoId.length
  var skipReasons = []
  var monthStats = {}

  for (var si = 0; si < skippedNoId.length; si++) {
    var skipMes = skippedNoId[si].mes || 'sem_mes'
    if (!monthStats[skipMes]) {
      monthStats[skipMes] = { read: 0, created: 0, updated: 0, skipped: 0, sumValores: 0 }
    }
    monthStats[skipMes].read++
    monthStats[skipMes].skipped++
  }

  for (var i = 0; i < totalRecords; i++) {
    try {
      var d = dedupedRows[i]
      var exiId = d.exiId
      var mes = d.mes_faturamento || 'sem_mes'

      if (!monthStats[mes]) {
        monthStats[mes] = { read: 0, created: 0, updated: 0, skipped: 0, sumValores: 0 }
      }
      monthStats[mes].read++
      monthStats[mes].sumValores += parseValores(d.valores)

      var existing = existingByImportKey[exiId]

      if (needsReconciliation && !existing) {
        var oldKey = buildOldCompositeKey(d)
        existing = existingByOldKey[oldKey]
        if (existing) {
          delete existingByOldKey[oldKey]
        }
      }

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
        existing.set('importKey', exiId)
        $app.saveNoValidate(existing)
        updated++
        monthStats[mes].updated++
        existingByImportKey[exiId] = existing
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
        record.set('importKey', exiId)
        $app.saveNoValidate(record)
        created++
        monthStats[mes].created++
        existingByImportKey[exiId] = record
      }
    } catch (recordErr) {
      skippedCount++
      if (skipReasons.length < 10) {
        skipReasons.push('Registro ' + i + ': ' + String(recordErr))
      }
    }
  }

  for (var mes in monthStats) {
    var s = monthStats[mes]
    $app
      .logger()
      .info(
        'sync_google_sheets: resumo mensal',
        'mes',
        mes,
        'rowsRead',
        s.read,
        'created',
        s.created,
        'updated',
        s.updated,
        'skipped',
        s.skipped,
        'sumValores',
        s.sumValores,
      )
  }

  if (skippedNoId.length > 0) {
    var sampleIds = skippedNoId.slice(0, 10).map(function (s) {
      return s.identificacao || '(sem identificacao)'
    })
    $app
      .logger()
      .info(
        'sync_google_sheets: linhas sem ID_SERVICO',
        'count',
        skippedNoId.length,
        'samples',
        sampleIds.join('; '),
      )
  }

  var summary =
    'Linhas lidas: ' +
    (totalRecords + skippedNoId.length) +
    ' | Criados: ' +
    created +
    ' | Atualizados: ' +
    updated +
    ' | Ignorados: ' +
    skippedCount +
    (skippedNoId.length > 0 ? ' | Sem ID_SERVICO: ' + skippedNoId.length : '') +
    (skipReasons.length > 0 ? ' | Motivos: ' + skipReasons.join('; ') : '')

  logSync('success', totalRecords + skippedNoId.length, created + updated, summary)
  $app
    .logger()
    .info(
      'sync_google_sheets: sincronização concluída',
      'created',
      created,
      'updated',
      updated,
      'skipped',
      skippedCount,
      'total',
      totalRecords,
    )
})
