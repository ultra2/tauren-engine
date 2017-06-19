FROM node:7.2.1

RUN useradd --user-group --create-home --shell /bin/false app &&\
  npm install --global npm@3.10.10

ENV HOME=/home/app

USER app
WORKDIR $HOME/chat