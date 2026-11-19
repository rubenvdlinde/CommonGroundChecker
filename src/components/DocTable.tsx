import type { PathTable } from "@/lib/pathDocs";

/** A small table from the docs data. The first cell of each row is its header. */
export default function DocTable({ table }: { table: PathTable }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm text-gray-700">
        <caption className="sr-only">{table.caption}</caption>
        <thead>
          <tr className="border-b border-gray-200">
            {table.columns.map((column) => (
              <th key={column} scope="col" className="py-2 pr-4 font-semibold text-gray-800">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map(([header, ...cells]) => (
            <tr key={header} className="border-b border-gray-100">
              <th scope="row" className="py-2 pr-4 font-normal">
                {header}
              </th>
              {cells.map((cell, index) => (
                <td key={index} className="py-2 pr-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
