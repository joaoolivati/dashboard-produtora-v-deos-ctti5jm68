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
        { name: 'data_servico', type: 'text' },
        { name: 'especialista', type: 'text' },
        { name: 'tipo_video', type: 'text' },
        { name: 'video_bruto', type: 'text' },
        { name: 'video_editado', type: 'text' },
        { name: 'valores', type: 'number' },
        { name: 'observacoes', type: 'text' },
        { name: 'editor', type: 'text' },
        { name: 'mes_faturamento', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_servicos_identificacao_unique ON servicos (identificacao) WHERE identificacao != ''",
        'CREATE INDEX idx_servicos_data_servico ON servicos (data_servico)',
        'CREATE INDEX idx_servicos_mes_faturamento ON servicos (mes_faturamento)',
        'CREATE INDEX idx_servicos_especialista ON servicos (especialista)',
        'CREATE INDEX idx_servicos_tipo_video ON servicos (tipo_video)',
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
