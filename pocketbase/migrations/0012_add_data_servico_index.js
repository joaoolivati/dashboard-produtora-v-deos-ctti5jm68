migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('servicos')
    col.addIndex('idx_servicos_data_servico', false, 'data_servico', '')
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('servicos')
    col.removeIndex('idx_servicos_data_servico')
    app.save(col)
  },
)
