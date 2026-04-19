export const LAB_IMAGES = {
  linux: {
    tool: "linux",
    displayName: "Linux Lab",
    image: "ubuntu:22.04",
    shell: ["/bin/bash"],
    keepAliveCmd: ["sleep", "infinity"],
    env: ["TERM=xterm-256color"],
  },
  git: {
    tool: "git",
    displayName: "Git Lab",
    image: "custom/git-lab:latest",
    shell: ["/bin/bash"],
    keepAliveCmd: ["sleep", "infinity"],
    env: ["TERM=xterm-256color"],
  },
  docker: {
    tool: "docker",
    displayName: "Docker Lab",
    image: "custom/devops-base:latest",
    shell: ["/bin/bash"],
    /**
     * These container ports are published to random host ports at session start.
     * Map inner services with the same left side, e.g. `docker run -p 3000:80 nginx` uses slot 3000.
     * Browser: `/lab/<sessionId>?cp=3000` (default cp is 8080 when omitted).
     */
    publishContainerPorts: [8080, 3000, 5000, 8000, 9000, 1234, 5173, 4200],
    labProxyDefaultContainerPort: 8080,
    keepAliveCmd: [
      "/bin/bash",
      "-lc",
      "mkdir -p /var/run /var/lib/docker && dockerd --host=unix:///var/run/docker.sock --storage-driver=vfs >/var/log/dockerd.log 2>&1 & until docker info >/dev/null 2>&1; do sleep 1; done; tail -f /dev/null",
    ],
    env: ["TERM=xterm-256color", "DOCKER_HOST=unix:///var/run/docker.sock"],
    hostConfig: {
      Privileged: true,
    },
  },
  terraform: {
    tool: "terraform",
    displayName: "Terraform Lab",
    image: "custom/terraform-lab:latest",
    shell: ["/bin/bash"],
    keepAliveCmd: ["sleep", "infinity"],
    env: ["TERM=xterm-256color"],
  },
  nginx: {
    tool: "nginx",
    displayName: "Nginx Lab",
    image: "nginx:alpine",
    shell: ["/bin/bash"],
    publishContainerPort: 80,
    labProxyDefaultContainerPort: 80,
    env: ["TERM=xterm-256color"],
  },
};

export function getToolConfig(tool) {
  return LAB_IMAGES[tool] ?? LAB_IMAGES.linux;
}
