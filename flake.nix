{
  description = "Twenty Barks";

  nixConfig = {
    extra-substituters = [ "https://scottylabs.cachix.org" ];
    extra-trusted-public-keys = [
      "scottylabs.cachix.org-1:hajjEX5SLi/Y7yYloiXTt2IOr3towcTGRhMh1vu6Tjg="
    ];
  };

  inputs = {
    scottylabs.url = "git+https://git.cmu.dev/ScottyLabs/kennel";
    nixpkgs.follows = "scottylabs/nixpkgs";
    flake-parts.follows = "scottylabs/flake-parts";
  };

  outputs =
    inputs:
    inputs.flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [ inputs.scottylabs.flakeModules.default ];
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];

      perSystem =
        { helpers, ... }:
        {
          scottylabs = {
            project.name = "twenty-barks";

            postgres.enable = true;

            deno = {
              enable = true;
              react.enable = true;
            };

            # The local OAuth relay, so Andrew ID login works on localhost.
            ricochet = {
              enable = true;
              appUrl = "http://localhost:4173";
            };

            processes = {
              server = {
                run = "cd apps/server && PORT=3001 exec secretspec run -P dev -- deno task dev";
                depends = [ "postgres-setup" ];
              };
              web.run = "cd apps/web && deno task dev";
            };
          };

          # One service serves both the API and the built web app, so the browser only ever talks to its own origin.
          services.app =
            let
              web = helpers.buildDenoTask {
                src = ./.;
                cwd = "apps/web";
                pname = "twenty-barks-web";
              };
            in
            {
              package = helpers.buildDenoTask {
                src = ./.;
                cwd = "apps/server";
                pname = "twenty-barks";
                entrypoint = "src/main.ts";
                compile = true;
              };
              env.STATIC_DIR = "${web}";
              customDomain = "twentybarks.scottylabs.org";
            };
        };
    };
}
