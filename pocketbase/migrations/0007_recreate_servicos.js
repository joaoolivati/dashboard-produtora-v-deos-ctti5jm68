/// <reference path="../pb_data/types.d.ts" />

// Recreates the 'servicos' collection after it was accidentally deleted.
// Rebuilds the full final schema (fields + indexes + API rules) matching the
// combined state of migrations 0001 + 0004 + 0006 and src/lib/pocketbase/schema.json.
// Idempotent: does nothing if the collection already exists.
migrate(
  (app) => {
    let existing = null
    try {
      existing = app.findCollectionByNameOrId('servicos')
    } catch (_) {}
    if (existing) return

    const collection = new Collection({
      name: 'servicos',
      type: 'base',
      // Reads require an authenticated user; writes are public (as in migration 0004).
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: '',
      updateRule: '',
      deleteRule: '',
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
        "CREATE UNIQUE INDEX idx_servicos_identificacao_unique ON servicos (identificacao) WHERE identificacao != ''",
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
