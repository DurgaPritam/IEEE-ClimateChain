const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const id = (s) => ethers.id(s);
const T = (tonnes) => BigInt(tonnes) * 1000n; // tonnes -> kg

describe("VerdantRegistry", () => {
  async function deploy() {
    const [owner, operator, verifier, stranger] = await ethers.getSigners();
    const reg = await (await ethers.getContractFactory("VerdantRegistry")).deploy();
    const inst = id("TR-ANA-01");
    await reg.registerInstallation(inst, operator.address, id("operator-key"));
    await reg.setVerifier(verifier.address, id("verifier-key"), true);
    const report = id("report-2026-06");
    return { reg, owner, operator, verifier, stranger, inst, report };
  }

  async function verified() {
    const f = await deploy();
    await f.reg.connect(f.operator).anchorReport(f.inst, f.report, id("root"), "2026-06", T(100_000));
    await f.reg.connect(f.verifier).coSign(f.report);
    return f;
  }

  describe("administration", () => {
    it("only the owner registers installations and verifiers", async () => {
      const { reg, stranger, inst } = await deploy();
      await expect(reg.connect(stranger).registerInstallation(inst, stranger.address, id("k")))
        .to.be.revertedWithCustomError(reg, "NotOwner");
      await expect(reg.connect(stranger).setVerifier(stranger.address, id("k"), true))
        .to.be.revertedWithCustomError(reg, "NotOwner");
    });
  });

  describe("anchorReport", () => {
    it("anchors a pending report and emits an event", async () => {
      const { reg, operator, inst, report } = await deploy();
      await expect(reg.connect(operator).anchorReport(inst, report, id("root"), "2026-06", T(100_000)))
        .to.emit(reg, "ReportAnchored").withArgs(report, inst, "2026-06", id("root"), T(100_000));
      expect((await reg.reports(report)).status).to.equal(1);
    });

    it("rejects non-operators and unknown installations", async () => {
      const { reg, operator, stranger, inst, report } = await deploy();
      await expect(reg.connect(stranger).anchorReport(inst, report, id("r"), "2026-06", 1))
        .to.be.revertedWithCustomError(reg, "NotOperator");
      await expect(reg.connect(operator).anchorReport(id("nope"), report, id("r"), "2026-06", 1))
        .to.be.revertedWithCustomError(reg, "UnknownInstallation");
    });

    it("allows only one report per installation and period", async () => {
      const { reg, operator, inst, report } = await deploy();
      await reg.connect(operator).anchorReport(inst, report, id("r"), "2026-06", T(1));
      await expect(reg.connect(operator).anchorReport(inst, id("other"), id("r"), "2026-06", T(1)))
        .to.be.revertedWithCustomError(reg, "PeriodAlreadyReported").withArgs(report);
      await expect(reg.connect(operator).anchorReport(inst, report, id("r"), "2026-07", T(1)))
        .to.be.revertedWithCustomError(reg, "ReportExists");
    });
  });

  describe("coSign", () => {
    it("lets an allow-listed verifier co-sign once", async () => {
      const { reg, operator, verifier, inst, report } = await deploy();
      await reg.connect(operator).anchorReport(inst, report, id("r"), "2026-06", T(1));
      await expect(reg.connect(verifier).coSign(report))
        .to.emit(reg, "ReportCoSigned").withArgs(report, verifier.address, id("verifier-key"));
      await expect(reg.connect(verifier).coSign(report)).to.be.revertedWithCustomError(reg, "NotPending");
    });

    it("rejects strangers, revoked verifiers and the operator itself", async () => {
      const { reg, operator, verifier, stranger, inst, report } = await deploy();
      await reg.connect(operator).anchorReport(inst, report, id("r"), "2026-06", T(1));
      await expect(reg.connect(stranger).coSign(report)).to.be.revertedWithCustomError(reg, "NotVerifier");
      await reg.setVerifier(operator.address, id("k"), true);
      await expect(reg.connect(operator).coSign(report)).to.be.revertedWithCustomError(reg, "VerifierIsOperator");
      await reg.setVerifier(verifier.address, id("verifier-key"), false);
      await expect(reg.connect(verifier).coSign(report)).to.be.revertedWithCustomError(reg, "NotVerifier");
    });
  });

  describe("allocate", () => {
    it("allocates verified tonnes and tracks the remainder", async () => {
      const { reg, operator, report } = await verified();
      await expect(reg.connect(operator).allocate(report, id("SHIP-1"), id("DE-IMPORTER"), T(10_000)))
        .to.emit(reg, "TonnesAllocated").withArgs(report, id("SHIP-1"), id("DE-IMPORTER"), T(10_000), T(90_000));
      expect(await reg.remainingKg(report)).to.equal(T(90_000));
    });

    it("rejects over-allocation across importers (same green tonne sold twice)", async () => {
      const { reg, operator, report } = await verified();
      await reg.connect(operator).allocate(report, id("SHIP-1"), id("DE"), T(60_000));
      await reg.connect(operator).allocate(report, id("SHIP-2"), id("NL"), T(40_000));
      await expect(reg.connect(operator).allocate(report, id("SHIP-3"), id("IT"), T(1)))
        .to.be.revertedWithCustomError(reg, "OverAllocation").withArgs(0, T(1));
    });

    it("refuses unverified reports, reused shipments, zero amounts and strangers", async () => {
      const f = await deploy();
      await f.reg.connect(f.operator).anchorReport(f.inst, f.report, id("r"), "2026-06", T(10));
      await expect(f.reg.connect(f.operator).allocate(f.report, id("S"), id("I"), T(1)))
        .to.be.revertedWithCustomError(f.reg, "NotVerified");
      await f.reg.connect(f.verifier).coSign(f.report);
      await expect(f.reg.connect(f.stranger).allocate(f.report, id("S"), id("I"), T(1)))
        .to.be.revertedWithCustomError(f.reg, "NotOperator");
      await expect(f.reg.connect(f.operator).allocate(f.report, id("S"), id("I"), 0))
        .to.be.revertedWithCustomError(f.reg, "ZeroAmount");
      await f.reg.connect(f.operator).allocate(f.report, id("S"), id("I"), T(1));
      await expect(f.reg.connect(f.operator).allocate(f.report, id("S"), id("I"), T(1)))
        .to.be.revertedWithCustomError(f.reg, "ShipmentAlreadyAllocated");
    });
  });
});
