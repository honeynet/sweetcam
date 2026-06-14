ARG GO_VERSION=1.26
ARG ALPINE_VERSION=3.20

FROM golang:${GO_VERSION}-alpine AS build

ARG MEDIAMTX_VERSION=v1.18.2
ARG RTSP_SERVER_HEADER="RTSP Server"

RUN apk add --no-cache git

WORKDIR /src

COPY rtsp-server-banner.patch /tmp/rtsp-server-banner.patch

RUN git clone --depth 1 --branch "${MEDIAMTX_VERSION}" https://github.com/bluenviron/mediamtx.git .

RUN go mod download

RUN set -eux; \
    git apply /tmp/rtsp-server-banner.patch; \
    sed -i "s/const rtspServerHeader = \"RTSP Server\"/const rtspServerHeader = \"${RTSP_SERVER_HEADER}\"/" internal/servers/rtsp/server.go; \
    grep -F "const rtspServerHeader = \"${RTSP_SERVER_HEADER}\"" internal/servers/rtsp/server.go; \
    grep -F 'res.Header["Server"] = base.HeaderValue{rtspServerHeader}' internal/servers/rtsp/server.go

RUN go generate ./...

RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/mediamtx .

FROM alpine:${ALPINE_VERSION}

RUN apk add --no-cache ca-certificates

COPY --from=build /out/mediamtx /mediamtx

EXPOSE 8554/tcp 8000/udp 8001/udp

ENTRYPOINT ["/mediamtx"]
CMD ["/mediamtx.yml"]
