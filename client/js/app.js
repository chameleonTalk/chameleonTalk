angular.module('app', ['ngRoute', 'ngResource'])
  .config(['$routeProvider', '$locationProvider',
    function ($routeProvider, $locationProvider) {
      $routeProvider
        .when('/', {
          templateUrl: 'views/index.html',
          controller: 'ChatController'
        })
        .otherwise({
          redirectTo: '/'
        });

      $locationProvider.html5Mode(true);
  }]);
