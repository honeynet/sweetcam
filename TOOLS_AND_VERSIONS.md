# SweetCam Project - Tools and Versions Documentation

This document provides a list of all tools, frameworks, libraries and their versions used during the development of the SweetCam IP Camera Honeypot project.

## Table of Contents

- [Operating System](#operating-system)
- [Containerization & Orchestration](#containerization--orchestration)
- [Database](#database)
- [Web Framework & Libraries](#web-framework--libraries)
- [Testing Framework](#testing-framework)
- [Logging & Monitoring](#logging--monitoring)
- [Version Constraints](#version-constraints)

## Operating System

| Tool | Version | Usage |
|------|---------|-------|
| **Linux** | 6.12.25-amd64 | Primary development and deployment OS |
| **APT** | 3.0.2 (amd64) | Package manager for Debian-based containers |

## Containerization & Orchestration

| Tool | Version | Usage |
|------|---------|-------|
| **Docker** | 28.3.0 | Container runtime and management |
| **Docker Compose** | v2.37.3 | Multi-container orchestration |
| **Base Images** | | |
| ├── mysql:8.0 | 8.0 | Database service |
| ├── cowrie/cowrie | latest | SSH honeypot service |
| ├── grafana/grafana | latest | Monitoring dashboard |
| └── sweetcam-mediamtx | MediaMTX v1.18.2 | Custom RTSP/H.264 server image |


## Database

| Tool | Version | Usage |
|------|---------|-------|
| **MySQL** | 8.0 | Primary database system |
| **mysql2** | 3.2.0 - 3.14.3 | Node.js MySQL client library |

## Web Framework & Libraries

| Tool | Version | Usage |
|------|---------|-------|
| **Express.js** | 4.18.2 | Web application framework |
| **Pug** | 3.0.2 | Template engine |
| **bcrypt** | 5.1.0 | Password hashing |
| **jsonwebtoken** | 9.0.0 | JWT authentication |
| **cookie-parser** | 1.4.6 | Cookie parsing middleware |
| **express-session** | 1.17.3 | Session management |
| **multer** | 1.4.5-lts.1 | File upload handling |

## RTSP And Video Streaming

| Tool | Version | Usage |
|------|---------|-------|
| **MediaMTX** | v1.18.2 | Public RTSP H.264 server, built as `sweetcam-mediamtx:1.18.2-rtsp-server` |
| **FFmpeg** | Provided by container package image | Loops and publishes the H.264 camera video into MediaMTX |
| **x264/libx264** | Provided by FFmpeg build | H.264 encoding for the looped camera stream |

The MediaMTX image is pinned instead of using `latest` so the RTSP behavior and
the custom `RTSP Server` banner patch stay reproducible.

## Testing Framework

| Tool | Version | Usage |
|------|---------|-------|
| **Jest** | 29.5.0 - 29.7.0 | Testing framework |
| **Supertest** | 7.1.4 | HTTP testing library |
| **@types/jest** | 29.5.0 | TypeScript definitions for Jest |
| **jest-environment-node** | 29.7.0 | Node.js test environment |


## Logging & Monitoring

| Tool | Version | Usage |
|------|---------|-------|
| **Winston** | 3.8.2 - 3.11.0 | Logging framework |
| **winston-daily-rotate-file** | 4.7.1 | Daily log rotation |
| **Grafana** | Latest | Monitoring and visualization dashboard |


## Version Constraints

### Node.js Requirements
- **Minimum Version**: 14.0.0 (specified in main package.json)
- **Recommended Version**: 18.x (used in all Docker containers)

