/** Prisma's optional CLI/compiler peers are development tools, not client runtime dependencies. */
module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === '@prisma/client') {
        for (const name of ['prisma', 'typescript']) {
          if (pkg.peerDependencies) delete pkg.peerDependencies[name];
          if (pkg.peerDependenciesMeta) delete pkg.peerDependenciesMeta[name];
        }
      }
      return pkg;
    },
  },
};
