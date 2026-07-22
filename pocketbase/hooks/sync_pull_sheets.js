routerAdd(
  'POST',
  '/backend/v1/sync-pull-sheets',
  (e) => {
    var rawBody = e.requestInfo().body || {}
    if (rawBody.force !== undefined && typeof rawBody.force !== 'boolean') {
      return e.badRequestError('Corpo da requisicao invalido')
    }

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

    $app.logger().info('sync_pull_sheets: sincronizacao manual iniciada')

    if (!API_KEY) {
      $app.logger().error('sync_pull_sheets: GOOGLE_API_KEY nao configurado')
      return e.json(500, { error: 'GOOGLE_API_KEY nao configurado', status: 'error' })
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
        $app.logger().error('sync_pull_sheets: erro ao registrar historico', 'error', String(err))
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

    var normalizeKey = (raw) => (raw || '').toString().trim().toLowerCase().replace(/\s+/g, ' ')

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

    var buildOldKeyFromSheet = (d) =>
      [
        normalizeKey(d.mes_faturamento),
        normalizeKey(parseDate(d.data_servico)),
        normalizeKey(d.especialista),
        normalizeKey(d.tipo_video),
        normalizeKey(d.identificacao),
        normalizeValor(d.valores),
      ].join('|')

    var buildOldKeyFromRecord = (rec) =>
      [
        normalizeKey(rec.getString('mes_faturamento')),
        normalizeKey(rec.getString('data_servico')),
        normalizeKey(rec.getString('especialista')),
        normalizeKey(rec.getString('tipo_video')),
        normalizeKey(rec.getString('identificacao')),
        normalizeValor(rec.get('valores')),
      ].join('|')

    var res
    try {
      res = $http.send({
        url: API_URL,
        method: 'GET',
        timeout: 120,
        headers: { Accept: 'application/json' },
      })
    } catch (err) {
      $app.logger().error('sync_pull_sheets: falha na requisicao HTTP', 'error', String(err))
      logSync('error', 0, 0, 'Falha na requisicao HTTP: ' + String(err))
      return e.json(500, { error: 'Falha ao buscar dados do Google Sheets', status: 'error' })
    }

    if (res.statusCode !== 200) {
      var errMsg = 'Google Sheets API retornou status ' + res.statusCode
      if (res.json && res.json.error && res.json.error.message) errMsg = res.json.error.message
      logSync('error', 0, 0, errMsg)
      return e.json(502, { error: errMsg, statusCode: res.statusCode, status: 'error' })
    }

    var responseBody = res.json
    if (!responseBody && typeof res.body === 'string') {
      try {
        responseBody = JSON.parse(res.body)
      } catch (parseErr) {
        logSync('error', 0, 0, 'Erro ao parsear JSON: ' + String(parseErr))
        return e.json(502, { error: 'Erro ao parsear resposta da API', status: 'error' })
      }
    }

    if (!responseBody || !Array.isArray(responseBody.values)) {
      logSync('error', 0, 0, 'Resposta da API nao contem array de valores')
      return e.json(502, { error: 'Array de valores ausente na resposta', status: 'error' })
    }

    var values = responseBody.values
    if (values.length < 2) {
      logSync('error', 0, 0, 'Nenhuma linha de dados encontrada')
      return e.json(200, {
        message: 'Nenhum dado encontrado na planilha',
        rowsRead: 0,
        rowsSaved: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        status: 'success',
      })
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
      return e.json(502, {
        error: 'Coluna ID_SERVICO nao encontrada no cabecalho da planilha',
        status: 'error',
      })
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
        skippedNoId.push({ identificacao: cellStr(row, 3), mes: cellStr(row, 9) })
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
        id_servico: exiId,
      })
    }

    var dedupedMap = {}
    var dedupedKeys = []
    for (var i = 0; i < dataRows.length; i++) {
      var key = dataRows[i].id_servico
      if (!dedupedMap[key]) dedupedKeys.push(key)
      dedupedMap[key] = dataRows[i]
    }
    var dedupedRows = dedupedKeys.map((k) => dedupedMap[k])
    var totalRecords = dedupedRows.length

    var col
    try {
      col = $app.findCollectionByNameOrId('servicos')
    } catch (err) {
      logSync('error', totalRecords, 0, 'Colecao servicos nao encontrada: ' + String(err))
      return e.json(500, { error: 'Colecao servicos nao encontrada', status: 'error' })
    }

    var existingByIdServico = {}
    var existingByOldKey = {}
    var needsReconciliation = false
    var duplicatesToDelete = []

    var loadOffset = 0
    while (true) {
      var batch = $app.findRecordsByFilter('servicos', "id != ''", 'created', 500, loadOffset)
      if (batch.length === 0) break
      for (var b = 0; b < batch.length; b++) {
        var rec = batch[b]
        var idServ = rec.getString('id_servico') || ''
        if (idServ) {
          if (existingByIdServico[idServ]) {
            if (rec.getString('created') > existingByIdServico[idServ].getString('created')) {
              duplicatesToDelete.push(existingByIdServico[idServ])
              existingByIdServico[idServ] = rec
            } else {
              duplicatesToDelete.push(rec)
            }
          } else {
            existingByIdServico[idServ] = rec
          }
        } else {
          needsReconciliation = true
          var oldKey = buildOldKeyFromRecord(rec)
          if (existingByOldKey[oldKey]) {
            if (rec.getString('created') > existingByOldKey[oldKey].getString('created')) {
              duplicatesToDelete.push(existingByOldKey[oldKey])
              existingByOldKey[oldKey] = rec
            } else {
              duplicatesToDelete.push(rec)
            }
          } else {
            existingByOldKey[oldKey] = rec
          }
        }
      }
      if (batch.length < 500) break
      loadOffset += 500
    }

    for (var d = 0; d < duplicatesToDelete.length; d++) {
      try {
        $app.delete(duplicatesToDelete[d])
      } catch (_) {}
    }

    var created = 0
    var updated = 0
    var skippedCount = skippedNoId.length
    var monthStats = {}

    for (var si = 0; si < skippedNoId.length; si++) {
      var skipMes = skippedNoId[si].mes || 'sem_mes'
      if (!monthStats[skipMes]) {
        monthStats[skipMes] = { lidas: 0, criados: 0, atualizados: 0, ignoradas: 0, somaValores: 0 }
      }
      monthStats[skipMes].lidas++
      monthStats[skipMes].ignoradas++
      $app
        .logger()
        .info(
          'sync_pull_sheets: ignorado: sem ID_SERVICO',
          'identificacao',
          skippedNoId[si].identificacao || '(sem identificacao)',
          'mes',
          skipMes,
        )
    }

    for (var i = 0; i < totalRecords; i++) {
      try {
        var d = dedupedRows[i]
        var exiId = d.id_servico
        var mes = d.mes_faturamento || 'sem_mes'

        if (!monthStats[mes]) {
          monthStats[mes] = { lidas: 0, criados: 0, atualizados: 0, ignoradas: 0, somaValores: 0 }
        }
        monthStats[mes].lidas++
        monthStats[mes].somaValores += parseValores(d.valores)

        var existing = existingByIdServico[exiId]

        if (!existing && needsReconciliation) {
          var oldKey = buildOldKeyFromSheet(d)
          existing = existingByOldKey[oldKey]
          if (existing) delete existingByOldKey[oldKey]
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
          existing.set('id_servico', exiId)
          $app.saveNoValidate(existing)
          updated++
          monthStats[mes].atualizados++
          existingByIdServico[exiId] = existing
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
          record.set('id_servico', exiId)
          $app.saveNoValidate(record)
          created++
          monthStats[mes].criados++
          existingByIdServico[exiId] = record
        }
      } catch (recordErr) {
        skippedCount++
      }
    }

    for (var mes in monthStats) {
      var s = monthStats[mes]
      $app
        .logger()
        .info(
          'sync_pull_sheets: resumo mensal',
          'mes',
          mes,
          'linhas_lidas',
          s.lidas,
          'criados',
          s.criados,
          'atualizados',
          s.atualizados,
          'ignoradas',
          s.ignoradas,
          'soma_valores',
          s.somaValores,
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
      (skippedNoId.length > 0 ? ' | Sem ID_SERVICO: ' + skippedNoId.length : '')

    logSync('success', totalRecords + skippedNoId.length, created + updated, summary)
    $app
      .logger()
      .info(
        'sync_pull_sheets: sincronizacao concluida',
        'created',
        created,
        'updated',
        updated,
        'skipped',
        skippedCount,
        'total',
        totalRecords,
      )

    return e.json(200, {
      message: 'Sincronizacao concluida com sucesso',
      rowsRead: totalRecords + skippedNoId.length,
      rowsSaved: created + updated,
      created: created,
      updated: updated,
      skipped: skippedCount,
      skippedNoId: skippedNoId.length,
      status: 'success',
    })
  },
  $apis.requireAuth(),
)
