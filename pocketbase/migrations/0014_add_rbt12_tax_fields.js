migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('tax_settings')
    if (!col.fields.getByName('rbt12')) {
      col.fields.add(new NumberField({ name: 'rbt12' }))
    }
    if (!col.fields.getByName('nominalRate')) {
      col.fields.add(new NumberField({ name: 'nominalRate' }))
    }
    if (!col.fields.getByName('deduction')) {
      col.fields.add(new NumberField({ name: 'deduction' }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('tax_settings')
    ;['rbt12', 'nominalRate', 'deduction'].forEach(function (name) {
      if (col.fields.getByName(name)) {
        col.fields.removeByName(name)
      }
    })
    app.save(col)
  },
)
