// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title VERDANT-X registry for verified CBAM emission reports
/// @notice Stores fingerprints only: report hash, Merkle root of the private data and
///         signer key fingerprints. Hybrid post-quantum signatures are verified off-chain
///         (on-chain ML-DSA verification is too expensive today); the chain makes records
///         tamper-evident and enforces allocation limits across importers. It does not make
///         data true — that is the job of the plausibility guard and the accredited verifier.
contract VerdantRegistry {
    enum Status { None, Pending, Verified }

    struct Installation {
        address operator;
        bytes32 operatorKeyFingerprint; // sha256 over the operator's hybrid public keys
        bool active;
    }

    struct Report {
        bytes32 installationId;
        bytes32 merkleRoot;
        bytes32 operatorKeyFingerprint;
        bytes32 verifierKeyFingerprint;
        address verifier;
        uint256 verifiedKg;   // product mass available to allocate, in kg
        uint256 allocatedKg;
        Status status;
        string period;        // e.g. "2026-06"
    }

    struct Verifier {
        bytes32 keyFingerprint;
        bool active;
    }

    address public owner;
    mapping(bytes32 => Installation) public installations;
    mapping(address => Verifier) public verifiers;
    mapping(bytes32 => Report) public reports; // by report hash
    mapping(bytes32 => mapping(bytes32 => bytes32)) public reportForPeriod; // installation => keccak(period) => report hash
    mapping(bytes32 => bool) public shipmentUsed;

    event InstallationRegistered(bytes32 indexed installationId, address operator, bytes32 operatorKeyFingerprint);
    event VerifierSet(address indexed verifier, bytes32 keyFingerprint, bool active);
    event ReportAnchored(bytes32 indexed reportHash, bytes32 indexed installationId, string period, bytes32 merkleRoot, uint256 verifiedKg);
    event ReportCoSigned(bytes32 indexed reportHash, address indexed verifier, bytes32 verifierKeyFingerprint);
    event TonnesAllocated(bytes32 indexed reportHash, bytes32 indexed shipmentId, bytes32 importerId, uint256 kg, uint256 remainingKg);

    error NotOwner();
    error NotOperator();
    error NotVerifier();
    error UnknownInstallation();
    error PeriodAlreadyReported(bytes32 existingReport);
    error ReportExists();
    error UnknownReport();
    error NotPending();
    error NotVerified();
    error VerifierIsOperator();
    error ShipmentAlreadyAllocated();
    error ZeroAmount();
    error OverAllocation(uint256 availableKg, uint256 requestedKg);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ---- administration (in production: a governance or multisig role) ----

    function registerInstallation(bytes32 installationId, address operator, bytes32 operatorKeyFingerprint)
        external onlyOwner
    {
        installations[installationId] = Installation(operator, operatorKeyFingerprint, true);
        emit InstallationRegistered(installationId, operator, operatorKeyFingerprint);
    }

    function setVerifier(address verifier, bytes32 keyFingerprint, bool active) external onlyOwner {
        verifiers[verifier] = Verifier(keyFingerprint, active);
        emit VerifierSet(verifier, keyFingerprint, active);
    }

    // ---- reporting flow ----

    /// @notice Operator anchors a plant-signed report. One report per installation and period,
    ///         so verified tonnage cannot be counted twice.
    function anchorReport(
        bytes32 installationId,
        bytes32 reportHash,
        bytes32 merkleRoot,
        string calldata period,
        uint256 verifiedKg
    ) external {
        Installation storage inst = installations[installationId];
        if (!inst.active) revert UnknownInstallation();
        if (msg.sender != inst.operator) revert NotOperator();
        if (reports[reportHash].status != Status.None) revert ReportExists();
        if (verifiedKg == 0) revert ZeroAmount();
        bytes32 periodKey = keccak256(bytes(period));
        bytes32 existing = reportForPeriod[installationId][periodKey];
        if (existing != bytes32(0)) revert PeriodAlreadyReported(existing);

        reportForPeriod[installationId][periodKey] = reportHash;
        reports[reportHash] = Report({
            installationId: installationId,
            merkleRoot: merkleRoot,
            operatorKeyFingerprint: inst.operatorKeyFingerprint,
            verifierKeyFingerprint: bytes32(0),
            verifier: address(0),
            verifiedKg: verifiedKg,
            allocatedKg: 0,
            status: Status.Pending,
            period: period
        });
        emit ReportAnchored(reportHash, installationId, period, merkleRoot, verifiedKg);
    }

    /// @notice An allow-listed accredited verifier co-signs after reviewing the evidence off-chain.
    function coSign(bytes32 reportHash) external {
        Verifier storage v = verifiers[msg.sender];
        if (!v.active) revert NotVerifier();
        Report storage r = reports[reportHash];
        if (r.status == Status.None) revert UnknownReport();
        if (r.status != Status.Pending) revert NotPending();
        if (installations[r.installationId].operator == msg.sender) revert VerifierIsOperator();

        r.status = Status.Verified;
        r.verifier = msg.sender;
        r.verifierKeyFingerprint = v.keyFingerprint;
        emit ReportCoSigned(reportHash, msg.sender, v.keyFingerprint);
    }

    /// @notice Assign verified tonnes to a shipment for an importer. Reverts if the running
    ///         total would exceed the verified tonnage — the same green tonne cannot be sold twice.
    function allocate(bytes32 reportHash, bytes32 shipmentId, bytes32 importerId, uint256 kg) external {
        Report storage r = reports[reportHash];
        if (r.status == Status.None) revert UnknownReport();
        if (msg.sender != installations[r.installationId].operator) revert NotOperator();
        if (r.status != Status.Verified) revert NotVerified();
        if (kg == 0) revert ZeroAmount();
        if (shipmentUsed[shipmentId]) revert ShipmentAlreadyAllocated();
        uint256 available = r.verifiedKg - r.allocatedKg;
        if (kg > available) revert OverAllocation(available, kg);

        r.allocatedKg += kg;
        shipmentUsed[shipmentId] = true;
        emit TonnesAllocated(reportHash, shipmentId, importerId, kg, r.verifiedKg - r.allocatedKg);
    }

    function remainingKg(bytes32 reportHash) external view returns (uint256) {
        Report storage r = reports[reportHash];
        return r.verifiedKg - r.allocatedKg;
    }
}
