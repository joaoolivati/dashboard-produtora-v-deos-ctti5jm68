migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('servicos')
    app.truncateCollection(col)
    app.logger().info('0018: servicos collection truncated — all records deleted')
  },
  (app) => {
    // no-op: truncation is irreversible; schema remains intact
  },
)
