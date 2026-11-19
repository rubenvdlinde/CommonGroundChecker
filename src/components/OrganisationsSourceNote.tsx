/** Where the lists of users come from, shown on every Users page. */
export default function OrganisationsSourceNote() {
  return (
    <p className="text-sm text-gray-600">
      This list comes from what components declare under usedBy in their publiccode.yml, not from the organisations
      themselves. The names are self-declared by the maintainers and not verified. Only followed components count, with
      their latest scan. Usage is informative: it gives no stars and this is not a ranking.
    </p>
  );
}
