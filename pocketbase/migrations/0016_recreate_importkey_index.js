migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('servicos')

    try {
      col.removeIndex('idx_servicos_importkey_unique')
    } catch (_) {}

    app.db().newQuery("UPDATE servicos SET importKey = NULL WHERE importKey = ''").execute()

    try {
      app.findCollectionByNameOrId('deliveries')
      var allRecs = app.findRecordsByFilter('servicos', "id != ''", 'created', 100000, 0)
      var survivorMap = {}
      var dupIds = []
      for (var i = 0; i < allRecs.length; i++) {
        var ik = allRecs[i].getString('importKey') || ''
        if (!ik) continue
        if (survivorMap[ik]) {
          dupIds.push({ dupId: allRecs[i].id, survivorId: survivorMap[ik] })
        } else {
          survivorMap[ik] = allRecs[i].id
        }
      }
      for (var d = 0; d < dupIds.length; d++) {
        try {
          var deliveries = app.findRecordsByFilter(
            'deliveries',
            "demandId = '" + dupIds[d].dupId + "'",
            '',
            100,
            0,
          )
          for (var dd = 0; dd < deliveries.length; dd++) {
            deliveries[dd].set('demandId', dupIds[d].survivorId)
            app.saveNoValidate(deliveries[dd])
          }
        } catch (_) {}
      }
    } catch (_) {}

    app
      .db()
      .newQuery(
        'DELETE FROM servicos WHERE id NOT IN (SELECT MIN(id) FROM servicos GROUP BY importKey) AND importKey IS NOT NULL',
      )
      .execute()

    col.addIndex('idx_servicos_importkey_unique', true, 'importKey', '')
    app.save(col)

    app.logger().info('0016: unique index on importKey recreated without WHERE clause')
  },
  (app) => {
    var col = app.findCollectionByNameOrId('servicos')
    try {
      col.removeIndex('idx_servicos_importkey_unique')
    } catch (_) {}
    col.addIndex('idx_servicos_importkey_unique', true, 'importKey', "importKey != ''")
    app.save(col)
  },
)
