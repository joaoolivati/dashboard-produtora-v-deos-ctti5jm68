migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('servicos')

    col.listRule = "@request.auth.id != ''"
    col.viewRule = "@request.auth.id != ''"
    col.createRule = ''
    col.updateRule = ''
    col.deleteRule = ''

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('servicos')

    col.listRule = "@request.auth.id != ''"
    col.viewRule = "@request.auth.id != ''"
    col.createRule = "@request.auth.id != ''"
    col.updateRule = "@request.auth.id != ''"
    col.deleteRule = "@request.auth.id != ''"

    app.save(col)
  },
)
