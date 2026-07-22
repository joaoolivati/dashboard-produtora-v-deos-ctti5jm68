migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('servicos')

    if (!col.fields.getByName('importKey')) {
      col.fields.add(new TextField({ name: 'importKey' }))
    }
    app.save(col)

    var normalizeKey = (raw) => {
      return (raw || '').toString().trim().toLowerCase().replace(/\s+/g, ' ')
    }

    var normalizeValor = (raw) => {
      if (typeof raw === 'number') return String(raw)
      var v = (raw || '0').toString().trim()
      v = v
        .replace(/R\$/gi, '')
        .replace(/\s/g, '')
        .replace(/[^\d.,-]/g, '')
      if (!v) return '0'
      if (v.indexOf(',') > -1 && v.indexOf('.') > -1) {
        v = v.replace(/\./g, '').replace(',', '.')
      } else if (v.indexOf(',') > -1) {
        v = v.replace(',', '.')
      }
      var n = parseFloat(v)
      return isNaN(n) ? '0' : String(n)
    }

    var buildImportKey = (record) => {
      var parts = [
        normalizeKey(record.getString('mes_faturamento')),
        normalizeKey(record.getString('data_servico')),
        normalizeKey(record.getString('especialista')),
        normalizeKey(record.getString('tipo_video')),
        normalizeKey(record.getString('identificacao')),
        normalizeValor(record.get('valores')),
      ]
      return parts.join('|')
    }

    var allRecords = []
    try {
      allRecords = app.findRecordsByFilter('servicos', "id != ''", 'created', 100000, 0)
    } catch (_) {
      allRecords = []
    }

    var keyMap = {}
    var duplicates = []

    for (var i = 0; i < allRecords.length; i++) {
      var record = allRecords[i]
      var key = buildImportKey(record)
      record.set('importKey', key)

      if (keyMap[key]) {
        duplicates.push(record)
      } else {
        keyMap[key] = record
        app.saveNoValidate(record)
      }
    }

    for (var d = 0; d < duplicates.length; d++) {
      try {
        app.delete(duplicates[d])
      } catch (_) {}
    }

    app
      .logger()
      .info(
        '0015_importkey: backfill concluido',
        'totalRecords',
        allRecords.length,
        'duplicates',
        duplicates.length,
      )

    try {
      col.addIndex('idx_servicos_importkey_unique', true, 'importKey', "importKey != ''")
    } catch (_) {}
    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('servicos')

    try {
      col.removeIndex('idx_servicos_importkey_unique')
    } catch (_) {}

    if (col.fields.getByName('importKey')) {
      col.fields.removeByName('importKey')
    }
    app.save(col)
  },
)
