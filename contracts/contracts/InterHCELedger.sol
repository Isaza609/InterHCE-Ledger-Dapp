// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * InterHCELedger - contrato base para trazabilidad en testnet.
 * Almacena exclusivamente metadatos no sensibles y hashes.
 */
contract InterHCELedger {
    enum Rol {
        Ninguno,
        Paciente,
        ProfesionalSalud,
        AdminIps,
        Auditor
    }

    struct Usuario {
        Rol rol;
        bytes32 ipsIdHash;
        bool activo;
    }

    struct Episodio {
        bytes32 episodeIdHash;
        bytes32 eventIdHash;
        bytes32 currentDocumentHash;
        uint256 versionActual;
        bool exists;
    }

    address public owner;
    mapping(address => Usuario) public usuarios;
    mapping(bytes32 => Episodio) public episodios;

    event UsuarioGestionado(
        address indexed actor,
        address indexed usuario,
        Rol rol,
        bytes32 ipsIdHash,
        bool activo
    );
    event EpisodioRegistrado(
        bytes32 indexed episodeIdHash,
        bytes32 indexed eventIdHash,
        bytes32 documentHash,
        uint256 version,
        bytes32 actorIpsHash
    );
    event EpisodioActualizado(
        bytes32 indexed episodeIdHash,
        bytes32 indexed eventIdHash,
        bytes32 documentHash,
        uint256 version,
        bytes32 actorIpsHash
    );
    event PermisoDocumentoActualizado(
        bytes32 indexed episodeIdHash,
        bytes32 indexed sourceIpsHash,
        bytes32 indexed targetIpsHash,
        bool granted
    );
    event TrazaOperacion(
        bytes32 indexed episodeIdHash,
        string action,
        bytes32 indexed actorIpsHash,
        bytes payload,
        uint256 timestamp
    );
    event TrazaRaw(
        address indexed actor,
        bytes payload,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Solo owner");
        _;
    }

    modifier onlyRol(Rol rol) {
        require(usuarios[msg.sender].activo, "Usuario inactivo");
        require(usuarios[msg.sender].rol == rol, "Rol no autorizado");
        _;
    }

    modifier onlyClinicalActor() {
        require(usuarios[msg.sender].activo, "Usuario inactivo");
        Rol rol = usuarios[msg.sender].rol;
        require(
            rol == Rol.ProfesionalSalud || rol == Rol.AdminIps,
            "Rol no autorizado"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
        usuarios[msg.sender] = Usuario({
            rol: Rol.AdminIps,
            ipsIdHash: bytes32(0),
            activo: true
        });
    }

    function gestionarUsuario(
        address user,
        Rol rol,
        bytes32 ipsIdHash,
        bool activo
    ) external onlyOwner {
        usuarios[user] = Usuario({
            rol: rol,
            ipsIdHash: ipsIdHash,
            activo: activo
        });
        emit UsuarioGestionado(msg.sender, user, rol, ipsIdHash, activo);
    }

    function registrarEpisodio(
        bytes32 episodeIdHash,
        bytes32 eventIdHash,
        bytes32 documentHash,
        bytes32 actorIpsHash
    ) external onlyClinicalActor {
        require(!episodios[episodeIdHash].exists, "Episodio ya existe");
        episodios[episodeIdHash] = Episodio({
            episodeIdHash: episodeIdHash,
            eventIdHash: eventIdHash,
            currentDocumentHash: documentHash,
            versionActual: 1,
            exists: true
        });
        emit EpisodioRegistrado(
            episodeIdHash,
            eventIdHash,
            documentHash,
            1,
            actorIpsHash
        );
    }

    function actualizarEpisodio(
        bytes32 episodeIdHash,
        bytes32 eventIdHash,
        bytes32 documentHash,
        bytes32 actorIpsHash
    ) external onlyClinicalActor {
        Episodio storage ep = episodios[episodeIdHash];
        require(ep.exists, "Episodio no existe");
        require(ep.eventIdHash == eventIdHash, "Evento no coincide");
        ep.versionActual += 1;
        ep.currentDocumentHash = documentHash;
        emit EpisodioActualizado(
            episodeIdHash,
            eventIdHash,
            documentHash,
            ep.versionActual,
            actorIpsHash
        );
    }

    function registrarPermisoDocumento(
        bytes32 episodeIdHash,
        bytes32 sourceIpsHash,
        bytes32 targetIpsHash,
        bool granted
    ) external onlyRol(Rol.AdminIps) {
        emit PermisoDocumentoActualizado(
            episodeIdHash,
            sourceIpsHash,
            targetIpsHash,
            granted
        );
    }

    function registrarTraza(
        bytes32 episodeIdHash,
        string calldata action,
        bytes32 actorIpsHash,
        bytes calldata payload
    ) external {
        emit TrazaOperacion(
            episodeIdHash,
            action,
            actorIpsHash,
            payload,
            block.timestamp
        );
    }

    fallback(bytes calldata data) external payable returns (bytes memory) {
        emit TrazaRaw(msg.sender, data, block.timestamp);
        return "";
    }
}
