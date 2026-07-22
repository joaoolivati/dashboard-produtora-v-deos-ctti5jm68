migrate(
  (app) => {
    var servicosCol
    try {
      servicosCol = app.findCollectionByNameOrId('servicos')
    } catch (err) {
      app.logger().error('0019: colecao servicos nao encontrada: ' + String(err))
      return
    }

    var servicosColId = servicosCol.id

    var hasDependencies = false
    try {
      var rows = app
        .db()
        .newQuery("SELECT name, fields FROM _collections WHERE name != 'servicos'")
        .all()
      for (var i = 0; i < rows.length; i++) {
        var colName = rows[i]['name'] || ''
        var fieldsRaw = rows[i]['fields'] || '[]'
        var fields
        try {
          fields = JSON.parse(fieldsRaw)
        } catch (_) {
          continue
        }
        for (var f = 0; f < fields.length; f++) {
          var fld = fields[f]
          if (fld.type !== 'relation') continue
          var relColId = fld.collectionId || (fld.options ? fld.options.collectionId : '') || ''
          if (relColId === servicosColId) {
            var count = 0
            try {
              count = app.countRecords(colName)
            } catch (_) {
              count = 0
            }
            if (count > 0) {
              app
                .logger()
                .error(
                  '0019: dependencia encontrada - colecao ' +
                    colName +
                    ' com ' +
                    count +
                    ' registros referenciando servicos',
                )
              hasDependencies = true
            }
          }
        }
      }
    } catch (err) {
      app
        .logger()
        .info(
          '0019: verificacao de dependencias via SQL falhou, usando lista manual: ' + String(err),
        )
      var knownCols = ['users', 'sync_history', 'recurring_costs', 'monthly_costs', 'tax_settings']
      for (var k = 0; k < knownCols.length; k++) {
        try {
          var kc = app.findCollectionByNameOrId(knownCols[k])
          var kcFields = kc.fields.all ? kc.fields.all() : []
          for (var kf = 0; kf < kcFields.length; kf++) {
            var kfRel = kcFields[kf]
            if (kfRel.type === 'relation') {
              var kfRelId = kfRel.collectionId || ''
              if (kfRelId === servicosColId) {
                var kcCount = app.countRecords(knownCols[k])
                if (kcCount > 0) {
                  app
                    .logger()
                    .error(
                      '0019: dependencia encontrada - colecao ' +
                        knownCols[k] +
                        ' com ' +
                        kcCount +
                        ' registros',
                    )
                  hasDependencies = true
                }
              }
            }
          }
        } catch (_) {}
      }
    }

    if (hasDependencies) {
      app.logger().error('0019: abortando rebuild devido a dependencias com registros')
      return
    }

    app.logger().info('0019: nenhuma dependencia encontrada, prosseguindo com purge')

    try {
      app.truncateCollection(servicosCol)
      app.logger().info('0019: colecao servicos purgada com sucesso - todos os registros removidos')
    } catch (err) {
      app.logger().error('0019: erro ao purgar colecao servicos: ' + String(err))
      return
    }

    var col = app.findCollectionByNameOrId('servicos')

    var indexes = col.indexes || []
    for (var idx = 0; idx < indexes.length; idx++) {
      var idxName = indexes[idx].name || indexes[idx].indexName || ''
      if (idxName === 'idx_servicos_id_servico_unique' || idxName === 'idx_servicos_id_servico') {
        try {
          col.removeIndex(idxName)
          app.logger().info('0019: indice removido: ' + idxName)
        } catch (_) {}
      }
    }

    try {
      col.addIndex('idx_servicos_id_servico', true, 'id_servico', '')
      app.save(col)
      app
        .logger()
        .info('0019: indice unico idx_servicos_id_servico criado com sucesso (sem clausula WHERE)')
    } catch (err) {
      app.logger().error('0019: erro ao criar indice idx_servicos_id_servico: ' + String(err))
    }
  },
  (app) => {
    app.logger().info('0019: downgrade - purge e irreversivel, schema permanece intacto')
  },
)
