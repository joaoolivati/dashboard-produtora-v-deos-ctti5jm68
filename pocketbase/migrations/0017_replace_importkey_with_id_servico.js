migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('servicos')

    try {
      col.removeIndex('idx_servicos_importkey_unique')
    } catch (_) {}

    if (!col.fields.getByName('id_servico')) {
      col.fields.add(new TextField({ name: 'id_servico' }))
    }

    app.save(col)

    if (col.fields.getByName('importKey')) {
      app.db().newQuery('UPDATE servicos SET id_servico = importKey').execute()
      col.fields.removeByName('importKey')
    }

    try {
      col.addIndex('idx_servicos_id_servico_unique', true, 'id_servico', '')
    } catch (_) {}
    app.save(col)

    app.logger().info('0017: importKey substituido por id_servico')
  },
  (app) => {
    var col = app.findCollectionByNameOrId('servicos')

    try {
      col.removeIndex('idx_servicos_id_servico_unique')
    } catch (_) {}

    if (!col.fields.getByName('importKey')) {
      col.fields.add(new TextField({ name: 'importKey' }))
    }

    app.save(col)

    if (col.fields.getByName('id_servico')) {
      app.db().newQuery('UPDATE servicos SET importKey = id_servico').execute()
      col.fields.removeByName('id_servico')
    }

    try {
      col.addIndex('idx_servicos_importkey_unique', true, 'importKey', '')
    } catch (_) {}

    app.save(col)
  },
)
