migrate(
  (app) => {
    const syncHistoryCollection = new Collection({
      name: 'sync_history',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'status', type: 'text', required: true },
        { name: 'rows_read', type: 'number' },
        { name: 'rows_saved', type: 'number' },
        { name: 'error_log', type: 'text' },
        { name: 'execution_date', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_sync_history_execution_date ON sync_history (execution_date)'],
    })
    app.save(syncHistoryCollection)

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

    try {
      const servicosCol = app.findCollectionByNameOrId('servicos')
      servicosCol.addIndex(
        'idx_servicos_identificacao_unique',
        true,
        'identificacao',
        "WHERE identificacao != ''",
      )
      app.save(servicosCol)
    } catch (_) {}
  },
  (app) => {
    try {
      const syncHistoryCollection = app.findCollectionByNameOrId('sync_history')
      app.delete(syncHistoryCollection)
    } catch (_) {}

    try {
      const servicosCol = app.findCollectionByNameOrId('servicos')
      servicosCol.removeIndex('idx_servicos_identificacao_unique')
      app.save(servicosCol)
    } catch (_) {}
  },
)
