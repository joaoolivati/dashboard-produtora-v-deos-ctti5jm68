migrate(
  (app) => {
    const collection = new Collection({
      name: 'servicos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'data_servico', type: 'date', required: true },
        { name: 'especialista', type: 'text' },
        { name: 'tipo_video', type: 'text' },
        { name: 'identificacao', type: 'text' },
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
        'CREATE INDEX idx_servicos_data ON servicos (data_servico)',
        'CREATE INDEX idx_servicos_especialista ON servicos (especialista)',
        'CREATE INDEX idx_servicos_mes ON servicos (mes_faturamento)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('servicos')
    app.delete(collection)
  },
)
