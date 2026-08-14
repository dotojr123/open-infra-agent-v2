import Docker from 'dockerode';

// Nunca aponta pro docker.sock cru — sempre pro tecnativa/docker-socket-proxy,
// que expõe só os endpoints liberados (CONTAINERS/NETWORKS/IMAGES) via HTTP.
// Dar acesso irrestrito ao socket pro control-plane equivale a root no host;
// o proxy limita o raio de dano de um bug aqui ou de um userId malicioso.
const host = process.env.DOCKER_PROXY_HOST || 'docker-socket-proxy';
const port = Number(process.env.DOCKER_PROXY_PORT) || 2375;

export const docker = new Docker({ host, port, protocol: 'http' });
