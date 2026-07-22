migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('role')) {
      usersCol.fields.add(
        new SelectField({
          name: 'role',
          values: ['admin', 'member'],
          maxSelect: 1,
        }),
      )
    }
    app.save(usersCol)

    try {
      const adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'joaok.olivati@gmail.com')
      adminUser.set('role', 'admin')
      app.save(adminUser)
    } catch (_) {}

    const recurringCosts = new Collection({
      name: 'recurring_costs',
      type: 'base',
      listRule: '@request.auth.role = "admin"',
      viewRule: '@request.auth.role = "admin"',
      createRule: '@request.auth.role = "admin"',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          name: 'category',
          type: 'select',
          values: ['fixo', 'salario', 'ferramenta'],
          maxSelect: 1,
        },
        { name: 'amount', type: 'number' },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_recurring_costs_active ON recurring_costs (active)',
        'CREATE INDEX idx_recurring_costs_category ON recurring_costs (category)',
      ],
    })
    app.save(recurringCosts)

    const monthlyCosts = new Collection({
      name: 'monthly_costs',
      type: 'base',
      listRule: '@request.auth.role = "admin"',
      viewRule: '@request.auth.role = "admin"',
      createRule: '@request.auth.role = "admin"',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
      fields: [
        { name: 'month', type: 'text' },
        { name: 'name', type: 'text' },
        {
          name: 'category',
          type: 'select',
          values: ['fixo', 'variavel', 'salario', 'ferramenta'],
          maxSelect: 1,
        },
        { name: 'amount', type: 'number' },
        { name: 'sourceId', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_monthly_costs_month ON monthly_costs (month)',
        'CREATE INDEX idx_monthly_costs_category ON monthly_costs (category)',
        'CREATE INDEX idx_monthly_costs_month_cat ON monthly_costs (month, category)',
      ],
    })
    app.save(monthlyCosts)

    const taxSettings = new Collection({
      name: 'tax_settings',
      type: 'base',
      listRule: '@request.auth.role = "admin"',
      viewRule: '@request.auth.role = "admin"',
      createRule: '@request.auth.role = "admin"',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
      fields: [
        { name: 'month', type: 'text' },
        { name: 'percentage', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_tax_settings_month ON tax_settings (month)'],
    })
    app.save(taxSettings)

    const rcCol = app.findCollectionByNameOrId('recurring_costs')
    const seeds = [
      { name: 'Aluguel Estúdio', category: 'fixo', amount: 3500 },
      { name: 'Internet', category: 'fixo', amount: 250 },
      { name: 'Energia Elétrica', category: 'fixo', amount: 800 },
      { name: 'Editor Sênior', category: 'salario', amount: 5000 },
      { name: 'Editor Júnior', category: 'salario', amount: 2800 },
      { name: 'Adobe Creative Cloud', category: 'ferramenta', amount: 350 },
      { name: 'Frame.io', category: 'ferramenta', amount: 150 },
    ]
    seeds.forEach((s) => {
      try {
        app.findFirstRecordByData('recurring_costs', 'name', s.name)
      } catch (_) {
        const r = new Record(rcCol)
        r.set('name', s.name)
        r.set('category', s.category)
        r.set('amount', s.amount)
        r.set('active', true)
        app.save(r)
      }
    })
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('tax_settings'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('monthly_costs'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('recurring_costs'))
    } catch (_) {}
  },
)
