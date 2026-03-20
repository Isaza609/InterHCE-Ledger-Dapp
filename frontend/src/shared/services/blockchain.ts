const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 11155111);
const CHAIN_HEX = `0x${CHAIN_ID.toString(16)}`;
const CONTRACT_ADDRESS = String(import.meta.env.VITE_TRACE_CONTRACT_ADDRESS ?? "").trim();
const EXPLORER_TX_BASE = String(
  import.meta.env.VITE_BLOCKCHAIN_EXPLORER_TX_BASE ?? "https://sepolia.etherscan.io/tx/"
).trim();

type EthereumLike = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
};

function getEthereum(): EthereumLike | null {
  if (typeof window === "undefined") return null;
  const maybe = (window as Window & { ethereum?: EthereumLike }).ethereum;
  return maybe ?? null;
}

function utf8ToHex(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return `0x${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

export async function conectarWallet(): Promise<{ ok: boolean; address?: string; message?: string }> {
  const eth = getEthereum();
  if (!eth) {
    return { ok: false, message: "No se detectó wallet EVM (MetaMask u otra)." };
  }
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  return { ok: true, address: accounts?.[0] };
}

export async function asegurarCadenaSepolia(): Promise<{ ok: boolean; message?: string }> {
  const eth = getEthereum();
  if (!eth) return { ok: false, message: "Wallet no disponible." };
  const chainId = String(await eth.request({ method: "eth_chainId" }));
  if (chainId.toLowerCase() === CHAIN_HEX.toLowerCase()) return { ok: true };
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_HEX }]
    });
    return { ok: true };
  } catch {
    return { ok: false, message: `Cambie la wallet a Sepolia (chainId ${CHAIN_ID}).` };
  }
}

export async function enviarTrazaBlockchain(input: {
  action: string;
  episodeId?: string;
  actorRole?: string;
  ipsId?: string;
  payload?: Record<string, unknown>;
}): Promise<{ ok: boolean; txHash?: string; explorerUrl?: string; message?: string }> {
  const eth = getEthereum();
  if (!eth) return { ok: false, message: "Wallet no disponible." };
  if (!CONTRACT_ADDRESS) {
    return {
      ok: false,
      message: "Falta VITE_TRACE_CONTRACT_ADDRESS para enviar trazas a testnet."
    };
  }
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const from = accounts?.[0];
  if (!from) return { ok: false, message: "No hay cuenta seleccionada en la wallet." };

  const body = JSON.stringify({
    action: input.action,
    episodeId: input.episodeId ?? null,
    actorRole: input.actorRole ?? null,
    ipsId: input.ipsId ?? null,
    payload: input.payload ?? {},
    timestamp: new Date().toISOString()
  });
  const data = utf8ToHex(body);

  const txHash = (await eth.request({
    method: "eth_sendTransaction",
    params: [
      {
        from,
        to: CONTRACT_ADDRESS,
        data
      }
    ]
  })) as string;

  return {
    ok: true,
    txHash,
    explorerUrl: `${EXPLORER_TX_BASE}${txHash}`
  };
}
