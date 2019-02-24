﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

using Microsoft.AspNetCore.SignalR;

namespace TronWebApp.Hubs
{    
    public class TronGameHub : Hub<ITronGameClient>
    {
        private readonly PlayerMatchmakingService _playersMatchmakingService;
        private readonly PlayerSpawnService _playerSpawnService;

        private static readonly Dictionary<string, TronGame> PlayerGameMap =
            new Dictionary<string, TronGame>();
        private static readonly object PlayerGameMapLock = new object();

        public TronGameHub(PlayerMatchmakingService playersMatchmakingService,
            PlayerSpawnService playerSpawnService)
        {
            _playersMatchmakingService = playersMatchmakingService;
            _playerSpawnService = playerSpawnService;            
        }

        public async Task FindGame(FindGameDto dto)
        {
            var tronPlayer = new TronPlayer
            {
                Name = dto.PlayerName,
                ConnectionId = Context.ConnectionId
            };

            var board = dto.PlayerBoard.ToModel();

            var pendingGame = _playersMatchmakingService.TryFind(new PendingGame
            {
                PlayerBoard = board,
                Player = tronPlayer
            });

            if (pendingGame != null)
            {
                var players = new List<TronPlayer>
                {
                    tronPlayer,
                    pendingGame.Player
                };

                var game = await CreateNewGame(players, board);

                await StartGame(game);
            }
        }

        public async Task DirectionChanged(DirectionChangedDto dto)
        {
            var connectionId = Context.ConnectionId;
            TronGame game;

            lock (PlayerGameMapLock)
            {
                PlayerGameMap.TryGetValue(connectionId, out game);
            }

            if (game != null)
            {
                var playerName = game.Players.First(p => p.ConnectionId == connectionId).Name;

                await Clients.GroupExcept(game.GroupName, connectionId)
                    .PlayerDirectionChanged(new PlayerDirectionChangedDto
                    {
                        Direction = dto.Direction,
                        PlayerName = playerName
                    });
            }            
        }

        public async Task GameFinished(GameFinishedDto dto)
        {
            var connectionId = Context.ConnectionId;
            TronGame game;

            lock (PlayerGameMapLock)
            {
                if (PlayerGameMap.TryGetValue(connectionId, out game))
                {                    
                    foreach (var player in game.Players)
                    {
                        PlayerGameMap.Remove(player.ConnectionId, out _);
                    }                    
                }
            }

            if (game != null)
            {
                await Clients.GroupExcept(game.GroupName, connectionId)
                    .GameFinished(dto);

                foreach (var player in game.Players)
                {
                    await Groups.RemoveFromGroupAsync(player.ConnectionId, game.GroupName);
                }
            }            
        }

        private async Task StartGame(TronGame game)
        {
            var players = game.Players;
            var positions = _playerSpawnService.GetPosition(players.Count, game.Board);
            var positionDtos = positions.ToDtos();

            for (int i = 0; i < players.Count; i++)
            {
                var position = positionDtos[i];
                var dto = new GameStartedDto
                {
                    Position = position,
                    Enemies = new List<EnemyPlayerDto>()
                };

                for (int j = 0; j < players.Count; j++)
                {
                    if (i == j)
                    {
                        continue;
                    }

                    dto.Enemies.Add(new EnemyPlayerDto
                    {
                        Name = players[j].Name,
                        Position = positionDtos[j]
                    });

                    await Clients.Client(players[i].ConnectionId).GameStarted(dto);
                }
            }
        }

        private async Task<TronGame> CreateNewGame(List<TronPlayer> players, GameBoard board)
        {
            var groupName = Guid.NewGuid().ToString();

            var game = new TronGame
            {
                GroupName = groupName,
                State = GameState.Playing,
                TimeCreated = DateTime.UtcNow,
                Players = players,
                Board = board
            };

            lock (PlayerGameMapLock)
            {
                foreach (var player in game.Players)
                {
                    PlayerGameMap.Add(player.ConnectionId, game);
                }
            }            

            foreach (var player in players)
            {                
                await Groups.AddToGroupAsync(player.ConnectionId, groupName);
            }

            return game;
        }
    }
}