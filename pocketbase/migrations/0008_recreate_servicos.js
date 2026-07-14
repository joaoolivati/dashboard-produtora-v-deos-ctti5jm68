migrate(
  (app) => {
    try {
      const existing = app.findCollectionByNameOrId('servicos')
      app.delete(existing)
    } catch (_) {}

    const collection = new Collection({
      name: 'servicos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'identificacao', type: 'text' },
        { name: 'descricao', type: 'text' },
        { name: 'categoria', type: 'text' },
        { name: 'status', type: 'text' },
        { name: 'cliente', type: 'text' },
        { name: 'data_entrega', type: 'text' },
        { name: 'valor', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_servicos_identificacao_unique ON servicos (identificacao) WHERE identificacao != ''",
        'CREATE INDEX idx_servicos_categoria ON servicos (categoria)',
        'CREATE INDEX idx_servicos_data_entrega ON servicos (data_entrega)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('servicos')
      app.delete(collection)
    } catch (_) {}
  },
)
