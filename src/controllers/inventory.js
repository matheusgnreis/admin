import { i19loading, i19loadMore } from '@ecomplus/i18n'
import { $ecomConfig, i18n } from '@ecomplus/utils'
import ecomClient from '@ecomplus/client'

export default function () {
  const { $, app, callApi } = window

  const size = 20
  let from = 0
  const datatableOptions = {
    pageLength: size,
    bLengthChange: false
  }
  if ($ecomConfig.get('lang') === 'pt_br') {
    datatableOptions.language = {
      aria: {
        sortAscending: ': ative para colocar a coluna em ordem crescente',
        sortDescending: ': ative para colocar a coluna em ordem decrescente'
      },
      paginate: {
        next: 'Próxima',
        previous: 'Anterior'
      },
      emptyTable: 'Tabela vazia',
      info: 'Mostrando _START_ a _END_ de _TOTAL_ SKUs carregados',
      infoEmpty: '',
      infoFiltered: '',
      lengthMenu: 'Mostrar _MENU_ resultados',
      search: 'Buscar',
      zeroRecords: 'Nenhum resultado encontrado'
    }
  }

  const $btnLoad = $('#inventory-load')
  $btnLoad.click(() => {
    from += size
    loadMore()
  })

  const datatable = $('#inventory-table').DataTable(datatableOptions)
  let allRows = []

  const loadMore = () => {
    $btnLoad.attr('disabled', true)
      .find('i').addClass('fa-spin')
      .next().text(i18n(i19loading))

    ecomClient.search({ url: `items.json?size=${size}&from=${from}&sort=sales:desc` })
      .then(({ data }) => {
        const { total, hits } = data.hits
        let i = 0
        const rows = []
        const addRow = ({ sku = '', name, quantity = 0 }) => {
          rows.push({
            sku,
            name,
            quantity,
            sold: 0
          })
        }

        const next = () => {
          if (hits && hits[i]) {
            const { _id, _source } = hits[i]
            addRow(_source)
            if (_source.variations) {
              _source.variations.forEach(addRow)
            }

            callApi(
              `orders.json?items.product_id=${_id}&status!=cancelled` +
                '&fields=items.product_id,items.sku,items.quantity',
              'GET',

              (err, json) => {
                let delay
                if (!err) {
                  const { result } = json
                  result.forEach(order => {
                    order.items.forEach(item => {
                      if (item.product_id === _id) {
                        const row = rows.find(({ sku }) => sku === item.sku)
                        if (row) {
                          row.sold += item.quantity
                        }
                      }
                    })
                  })
                  delay = 0
                } else {
                  console.error(err)
                  app.toast()
                  delay = 300
                }

                setTimeout(() => {
                  i++
                  next()
                }, delay)
              }
            )
          } else {
            allRows = allRows.concat(rows.map(({ sku, name, quantity, sold }) => {
              return [sku, name, quantity, sold]
            }))
            datatable.clear()
            datatable.rows.add(allRows)
            datatable.draw()

            if (total > from + size) {
              $btnLoad
                .attr('disabled', false)
                .find('i').removeClass('fa-spin')
                .next().text(i18n(i19loadMore))
            } else {
              $btnLoad.slideUp()
            }
          }
        }
        next()
      })

      .catch(err => {
        if (err) {
          console.error(err)
          app.toast()
        }
      })
  }
  loadMore()
}
