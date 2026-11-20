# The analysis tools of the checker image, for scanning the component list on
# your own machine (scripts/scan-local-and-publish.sh). Same base and versions
# as the static site workflow, which runs scripts/install-analysis-tools.sh.
FROM node:20-bookworm-slim
ENV HYDRA_GATE_TOOLS_DIR=/opt/analysis-tools
ENV HYDRA_GATE_SIG_NO_INSTALL=1
COPY install-analysis-tools.sh /tmp/install-analysis-tools.sh
RUN sh /tmp/install-analysis-tools.sh && rm /tmp/install-analysis-tools.sh \
  && git config --system --add safe.directory '*'
