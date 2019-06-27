import { RecordCollection, Record, container } from '../core/shared';

export function TableWidget(
    headerTitles: string[],
    makeRowContent: (record: Record) => (JQuery | string)[]
) {
    let values: RecordCollection = {};
    const dom = $('<table class="table"></table>');
    function setAllValues(recordCollection: RecordCollection) {
        values = recordCollection;
        rebuildTable();
    }
    function rebuildTable() {
        dom.empty();
        // headers
        dom.append(
            container('<thead></thead>')(
                container('<tr></tr>')(
                    headerTitles.map(str =>
                        container('<th scope="col"></th>')(str)
                    )
                )
            )
        );
        // content
        dom.append(
            container('<tbody></tbody>')(
                Object.values(values).map(record =>
                    container('<tr></tr>')(
                        makeRowContent(record).map((rowContent, i) =>
                            container(
                                i === 0 ? '<th scope="row"></th>' : '<td></td>'
                            )(
                                typeof rowContent === 'string'
                                    ? document.createTextNode(rowContent)
                                    : rowContent
                            )
                        )
                    )
                )
            )
        );
    }
    rebuildTable();
    return {
        dom,
        setAllValues
    };
}
