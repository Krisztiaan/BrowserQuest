
define(['jquery', 'app', 'eventcompat'], function($, App, EventCompat) {
var app, game;

    var getLegacyTestGlobal = function() {
        if(typeof window === 'undefined') {
            return null;
        }
        if(typeof globalThis !== 'undefined') {
            return globalThis;
        }
        return window;
    };

    var installLegacyTestApi = function() {
        var root = getLegacyTestGlobal();
        if(!root) {
            return;
        }
        if(!root.__BQ_LEGACY_TEST_MODE__ && !root.__BQ_TEST_MODE__) {
            return;
        }

        root.__BQ_LEGACY_TEST_API = {
            isReady: function() {
                return !!(app && game && app.ready && app.canStartGame && app.canStartGame());
            },

            getState: function() {
                return {
                    appReady: !!(app && app.ready),
                    canStartGame: !!(app && app.canStartGame && app.canStartGame()),
                    gameStarted: !!(game && game.started)
                };
            },

            startSession: function(name) {
                if(!app) {
                    return { ok: false, reason: 'app_unavailable' };
                }

                var nameFromInput = $('#nameinput').attr('value'),
                    nameFromStorage = $('#playername').html(),
                    username = name || nameFromInput || nameFromStorage;

                if(!username) {
                    return { ok: false, reason: 'name_required' };
                }
                if(game && game.started) {
                    return { ok: false, reason: 'already_started', username: username };
                }

                $('#nameinput').attr('value', username);
                app.toggleButton();
                app.tryStartingGame(username);
                return { ok: true, username: username };
            }
        };

        if(typeof root.__BQ_LEGACY_TEST_START__ === 'string' && root.__BQ_LEGACY_TEST_START__.length > 0) {
            var autoStartName = root.__BQ_LEGACY_TEST_START__,
                attempts = 0,
                maxAttempts = 300,
                watchReady = setInterval(function() {
                    attempts += 1;
                    if(root.__BQ_LEGACY_TEST_API.isReady()) {
                        clearInterval(watchReady);
                        root.__BQ_LEGACY_TEST_API.startSession(autoStartName);
                    } else if(attempts >= maxAttempts) {
                        clearInterval(watchReady);
                    }
                }, 50);
        }
    };

    var initApp = function() {
        $(document).ready(function() {
        	app = new App();
            installLegacyTestApi();
            app.center();
        
            if(Detect.isWindows()) {
                // Workaround for graphical glitches on text
                $('body').addClass('windows');
            }
            
            if(Detect.isOpera()) {
                // Fix for no pointer events
                $('body').addClass('opera');
            }
            
            if(Detect.isFirefoxAndroid()) {
                // Remove chat placeholder
                $('#chatinput').removeAttr('placeholder');
            }
        
            $('body').click(function(event) {
                if($('#parchment').hasClass('credits')) {
                    app.toggleScrollContent('credits');
                }
                
                if($('#parchment').hasClass('legal')) {
                    app.toggleScrollContent('legal');
                }
                
                if($('#parchment').hasClass('about')) {
                    app.toggleScrollContent('about');
                }
            });
	
        	$('.barbutton').click(function() {
        	    $(this).toggleClass('active');
        	});
	
        	$('#chatbutton').click(function() {
        	    if($('#chatbutton').hasClass('active')) {
        	        app.showChat();
        	    } else {
                    app.hideChat();
        	    }
        	});
	
        	$('#helpbutton').click(function() {
                if($('body').hasClass('about')) {
                    app.closeInGameScroll('about');
                    $('#helpbutton').removeClass('active');
                } else {
                    app.toggleScrollContent('about');
                }
        	});
	
        	$('#achievementsbutton').click(function() {
                app.toggleAchievements();
                if(app.blinkInterval) {
                    clearInterval(app.blinkInterval);
                }
                $(this).removeClass('blink');
        	});
	
        	$('#instructions').click(function() {
                app.hideWindows();
        	});
        	
        	$('#playercount').click(function() {
        	    app.togglePopulationInfo();
        	});
        	
        	$('#population').click(function() {
        	    app.togglePopulationInfo();
        	});
	
        	$('.clickable').click(function(event) {
                event.stopPropagation();
        	});
	
        	$('#toggle-credits').click(function() {
        	    app.toggleScrollContent('credits');
        	});
        	
        	$('#toggle-legal').click(function() {
        	    app.toggleScrollContent('legal');
        	    if(game.renderer.mobile) {
        	        if($('#parchment').hasClass('legal')) {
        	            $(this).text('close');
        	        } else {
                        $(this).text('Privacy');
        	        }
        	    };
        	});
	
        	$('#create-new span').click(function() {
        	    app.animateParchment('loadcharacter', 'confirmation');
        	});
	
        	$('.delete').click(function() {
                app.storage.clear();
        	    app.animateParchment('confirmation', 'createcharacter');
        	    $('body').removeClass('returning');
        	});
	
        	$('#cancel span').click(function() {
        	    app.animateParchment('confirmation', 'loadcharacter');
        	});
        	
        	$('.ribbon').click(function() {
                app.toggleScrollContent('about');
        	});

            EventCompat.bind($('#nameinput'), "keyup", function() {
                app.toggleButton();
            });
    
            $('#previous').click(function() {
                var $achievements = $('#achievements');
        
                if(app.currentPage === 1) {
                    return false;
                } else {
                    app.currentPage -= 1;
                    $achievements.removeClass().addClass('active page' + app.currentPage);
                }
            });
    
            $('#next').click(function() {
                var $achievements = $('#achievements'),
                    $lists = $('#lists'),
                    nbPages = $lists.children('ul').length;
        
                if(app.currentPage === nbPages) {
                    return false;
                } else {
                    app.currentPage += 1;
                    $achievements.removeClass().addClass('active page' + app.currentPage);
                }
            });

            EventCompat.bind($('#notifications div'), TRANSITIONEND, app.resetMessagesPosition.bind(app));
    
            $('.close').click(function() {
                app.hideWindows();
            });
        
            $('.twitter').click(function() {
                var url = $(this).attr('href');

               app.openPopup('twitter', url);
               return false;
            });

            $('.facebook').click(function() {
                var url = $(this).attr('href');

               app.openPopup('facebook', url);
               return false;
            });
        
            var data = app.storage.data;
    		if(data.hasAlreadyPlayed) {
    		    if(data.player.name && data.player.name !== "") {
		            $('#playername').html(data.player.name);
    		        $('#playerimage').attr('src', data.player.image);
    		    }
    		}
    		
    		$('.play div').click(function(event) {
                var nameFromInput = $('#nameinput').attr('value'),
                    nameFromStorage = $('#playername').html(),
                    name = nameFromInput || nameFromStorage;
                
                app.tryStartingGame(name);
            });
        
            document.addEventListener("touchstart", function() {},false);
            
            EventCompat.bind($('#resize-check'), "transitionend", app.resizeUi.bind(app));
            EventCompat.bind($('#resize-check'), "webkitTransitionEnd", app.resizeUi.bind(app));
            EventCompat.bind($('#resize-check'), "oTransitionEnd", app.resizeUi.bind(app));
        
            log.info("App initialized.");
        
            initGame();
        });
    };
    
    var initGame = function() {
        require(['game'], function(Game) {
            
            var canvas = document.getElementById("entities"),
        	    background = document.getElementById("background"),
        	    foreground = document.getElementById("foreground"),
        	    input = document.getElementById("chatinput");

    		game = new Game(app);
    		game.setup('#bubbles', canvas, background, foreground, input);
    		game.setStorage(app.storage);
    		app.setGame(game);
    		
    		if(app.isDesktop && app.supportsWorkers) {
    		    game.loadMap();
    		}
	
    		game.onGameStart(function() {
                app.initEquipmentIcons();
    		});
    		
    		game.onDisconnect(function(message) {
    		    $('#death').find('p').html(message+"<em>Please reload the page.</em>");
    		    $('#respawn').hide();
    		});
	
    		game.onPlayerDeath(function() {
    		    if($('body').hasClass('credits')) {
    		        $('body').removeClass('credits');
    		    }
                $('body').addClass('death');
    		});
	
    		game.onPlayerEquipmentChange(function() {
    		    app.initEquipmentIcons();
    		});
	
    		game.onPlayerInvincible(function() {
    		    $('#hitpoints').toggleClass('invincible');
    		});

    		game.onNbPlayersChange(function(worldPlayers, totalPlayers) {
    		    var setWorldPlayersString = function(string) {
        		        $("#instance-population").find("span:nth-child(2)").text(string);
        		        $("#playercount").find("span:nth-child(2)").text(string);
        		    },
        		    setTotalPlayersString = function(string) {
        		        $("#world-population").find("span:nth-child(2)").text(string);
        		    };
    		    
    		    $("#playercount").find("span.count").text(worldPlayers);
    		    
    		    $("#instance-population").find("span").text(worldPlayers);
    		    if(worldPlayers == 1) {
    		        setWorldPlayersString("player");
    		    } else {
    		        setWorldPlayersString("players");
    		    }
    		    
    		    $("#world-population").find("span").text(totalPlayers);
    		    if(totalPlayers == 1) {
    		        setTotalPlayersString("player");
    		    } else {
    		        setTotalPlayersString("players");
    		    }
    		});
	
    		game.onAchievementUnlock(function(id, name, description) {
    		    app.unlockAchievement(id, name);
    		});
	
    		game.onNotification(function(message) {
    		    app.showMessage(message);
    		});
	
            app.initHealthBar();
	
            $('#nameinput').attr('value', '');
    		$('#chatbox').attr('value', '');
    		
        	if(game.renderer.mobile || game.renderer.tablet) {
                EventCompat.bind($('#foreground'), 'touchstart', function(event) {
                    app.center();
                    app.setMouseCoordinates(event.originalEvent.touches[0]);
                    game.click();
                    app.hideWindows();
                });
            } else {
                $('#foreground').click(function(event) {
                    app.center();
                    app.setMouseCoordinates(event);
                    if(game) {
                	    game.click();
                	}
                	app.hideWindows();
                });
            }

            EventCompat.unbind($('body'), 'click');
            $('body').click(function(event) {
                var hasClosedParchment = false;
                
                if($('#parchment').hasClass('credits')) {
                    if(game.started) {
                        app.closeInGameScroll('credits');
                        hasClosedParchment = true;
                    } else {
                        app.toggleScrollContent('credits');
                    }
                }
                
                if($('#parchment').hasClass('legal')) {
                    if(game.started) {
                        app.closeInGameScroll('legal');
                        hasClosedParchment = true;
                    } else {
                        app.toggleScrollContent('legal');
                    }
                }
                
                if($('#parchment').hasClass('about')) {
                    if(game.started) {
                        app.closeInGameScroll('about');
                        hasClosedParchment = true;
                    } else {
                        app.toggleScrollContent('about');
                    }
                }
                
                if(game.started && !game.renderer.mobile && game.player && !hasClosedParchment) {
                    game.click();
                }
            });
            
            $('#respawn').click(function(event) {
                game.audioManager.playSound("revive");
                game.restart();
                $('body').removeClass('death');
            });
            
            $(document).mousemove(function(event) {
            	app.setMouseCoordinates(event);
            	if(game.started) {
            	    game.movecursor();
            	}
            });

            $(document).keydown(function(e) {
            	var key = e.which,
                    $chat = $('#chatinput');

                if(key === 13) {
                    if($('#chatbox').hasClass('active')) {
                        app.hideChat();
                    } else {
                        app.showChat();
                    }
                }
            });
            
            $('#chatinput').keydown(function(e) {
                var key = e.which,
                    $chat = $('#chatinput'),
                    placeholder = $(this).attr("placeholder");
                
                if (!(e.shiftKey && e.keyCode === 16) && e.keyCode !== 9) {
                    if ($(this).val() === placeholder) {
                        $(this).val('');
                        $(this).removeAttr('placeholder');
                        $(this).removeClass('placeholder');
                    }
                }
                
                if(key === 13) {
                    if($chat.attr('value') !== '') {
                        if(game.player) {
                            game.say($chat.attr('value'));
                        }
                        $chat.attr('value', '');
                        app.hideChat();
                        $('#foreground').focus();
                        return false;
                    } else {
                        app.hideChat();
                        return false;
                    }
                }
                
                if(key === 27) {
                    app.hideChat();
                    return false;
                }
            });
            
            $('#chatinput').focus(function(e) {
                var placeholder = $(this).attr("placeholder");
                
                if(!Detect.isFirefoxAndroid()) {
                    $(this).val(placeholder);
                }
                
                if ($(this).val() === placeholder) {
                    this.setSelectionRange(0, 0);
                }
            });
            
            $('#nameinput').focusin(function() {
                $('#name-tooltip').addClass('visible');
            });
            
            $('#nameinput').focusout(function() {
                $('#name-tooltip').removeClass('visible');
            });

            $('#nameinput').keypress(function(event) {
                var $name = $('#nameinput'),
                    name = $name.attr('value');

                $('#name-tooltip').removeClass('visible');

                if(event.keyCode === 13) {
                    if(name !== '') {
                        app.tryStartingGame(name, function() {
                            $name.blur(); // exit keyboard on mobile
                        });
                        return false; // prevent form submit
                    } else {
                        return false; // prevent form submit
                    }
                }
            });
            
            $('#mutebutton').click(function() {
                game.audioManager.toggle();
            });
            
            EventCompat.bind($(document), "keydown", function(e) {
            	var key = e.which,
            	    $chat = $('#chatinput');

                if($('#chatinput:focus').length === 0 && $('#nameinput:focus').length === 0) {
                    if(key === 13) { // Enter
                        if(game.ready) {
                            $chat.focus();
                            return false;
                        }
                    }
                    if(key === 32) { // Space
                        // game.togglePathingGrid();
                        return false;
                    }
                    if(key === 70) { // F
                        // game.toggleDebugInfo();
                        return false;
                    }
                    if(key === 27) { // ESC
                        app.hideWindows();
                        _.each(game.player.attackers, function(attacker) {
                            attacker.stop();
                        });
                        return false;
                    }
                    if(key === 65) { // a
                        // game.player.hit();
                        return false;
                    }
                } else {
                    if(key === 13 && game.ready) {
                        $chat.focus();
                        return false;
                    }
                }
            });
            
            if(game.renderer.tablet) {
                $('body').addClass('tablet');
            }
        });
    };
    
    initApp();
});
