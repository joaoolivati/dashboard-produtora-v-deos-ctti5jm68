migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('servicos')

    try {
      col.removeIndex('idx_servicos_importkey_unique')
    } catch (_) {}

    app.db().newQuery("UPDATE servicos SET importKey = NULL WHERE importKey = ''").execute()

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
