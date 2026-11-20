## Add a component

<!-- Use this template with ?template=add-component.md when you add or change an entry in config/repositories.yml. -->

Repository: <!-- https://github.com/example-org/example-component -->

- [ ] The repository is public.
- [ ] It has a publiccode.yml (not required, but the score is lower without it).
- [ ] I added only `url` and the fields I know: `scanRef`, `hints`, `register`, `basisset`, `providers`.
- [ ] A `providers` entry lists services on offer and a general contact address, no personal data. The repository owner is the provider anyway.

After the merge the component is scanned in the next nightly run, or sooner when a maintainer starts the "Static site" workflow by hand.
