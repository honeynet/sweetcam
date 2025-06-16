FROM bluenviron/mediamtx AS rtsp
FROM alpine:3.12
WORKDIR /app/rtsp
RUN apk add --no-cache ffmpeg
COPY --from=rtsp /mediamtx ./
COPY mediamtx.yml ./
RUN touch mediamtx.log
ENTRYPOINT [ "./mediamtx" ]