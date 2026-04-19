FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TERRAFORM_VERSION=1.9.8

RUN printf 'Acquire::Retries "5";\nAcquire::http::Timeout "30";\nAcquire::https::Timeout "30";\n' > /etc/apt/apt.conf.d/80-retries \
  && sed -i 's|http://archive.ubuntu.com/ubuntu/|http://azure.archive.ubuntu.com/ubuntu/|g' /etc/apt/sources.list \
  && sed -i 's|http://security.ubuntu.com/ubuntu/|http://azure.archive.ubuntu.com/ubuntu/|g' /etc/apt/sources.list \
  && rm -rf /var/lib/apt/lists/* \
  && apt-get update -o Acquire::Retries=5 \
  && apt-get install -y --fix-missing --no-install-recommends \
    git \
    curl \
    vim \
    unzip \
    ca-certificates \
    bash \
  && apt-get install -f -y \
  && curl -fsSL "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip" -o /tmp/terraform.zip \
  && unzip /tmp/terraform.zip -d /usr/local/bin \
  && chmod +x /usr/local/bin/terraform \
  && rm -f /tmp/terraform.zip \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

CMD ["sleep", "infinity"]
