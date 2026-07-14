migrate(
  (app) => {
    try {
      app
        .db()
        .newQuery(`
          DELETE FROM servicos WHERE id NOT IN (
            SELECT MIN(id) FROM servicos GROUP BY identificacao
          ) AND identificacao != ''
        `)
        .execute()
    } catch (_) {}

    const col = app.findCollectionByNameOrId('servicos')
    col.removeIndex('idx_servicos_identificacao_unique')
    col.addIndex('idx_servicos_identificacao_unique', true, 'identificacao', "identificacao != ''")
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('servicos')
    col.removeIndex('idx_servicos_identificacao_unique')
    col.addIndex(
      'idx_servicos_identificacao_unique',
      true,
      'identificacao',
      "WHERE identificacao != ''",
    )
    app.save(col)
  },
)
