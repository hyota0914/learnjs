describe('LearnJS', function() {

  it('can show a problem view', function() {
    learnjs.showView('#problem-1');
    expect($('.view-container .problem-view').length).toEqual(1);
  });

  it('shows the landing page view when there is nohash', function() {
    learnjs.showView('');
    expect($('.view-container .landing-view').length).toEqual(1);
  });
  
  it('passes the hash view parameter to the view function', function() {
    spyOn(learnjs, 'problemView');
    learnjs.showView('#problem-42');
    expect(learnjs.problemView).toHaveBeenCalledWith('42');
  });

  it('invokes the router when loaded', function() {
    spyOn(learnjs, 'showView');
    learnjs.appOnReady();
    expect(learnjs.showView).toHaveBeenCalledWith(window.location.hash);
  });

  it('subscribes to the hash change event', function() {
    learnjs.appOnReady();
    spyOn(learnjs, 'showView');
    $(window).trigger('hashchange');
    expect(learnjs.showView).toHaveBeenCalledWith(window.location.hash);
  });

  describe('problem view', function() {
    var view = null;

    beforeEach(function() {
      view = learnjs.problemView('1');
    });

    it('has a title that includes the problem number', function() {
      expect(view.find(".title").text()).toEqual('Problem #1');
    });

    it('shows the description', function() {
      expect(view.find('[data-name="description"]').text()).toEqual('What is truth?');
    });

    it('shows the code', function() {
      expect(view.find('[data-name="code"]').text()).toEqual('function problem () { return __; }');
    });

    describe('answer section', function() {
      var resultFlash;

      beforeEach(function() {
        spyOn(learnjs, 'flashElement');
        resultFlash = view.find('.result');
      });

      describe('when the answer is correct', function() {
        beforeEach(function() {
          view.find('.answer').val('true');
          view.find('.check-btn').click();
        });

        it('can check a correct answer by hitting a button', function() {
          var flashArgs = learnjs.flashElement.calls.argsFor(0);
          expect(flashArgs[0]).toEqual(resultFlash)
          expect(flashArgs[1].find('span').text()).toEqual('Correct!');
        });

        it('shows a link to the next problem', function() {
          var link = learnjs.flashElement.calls.argsFor(0)[1].find('a');
          expect(link.text()).toEqual('Next Problem')
          expect(link.attr('href')).toEqual('#problem-2');
        });
      });

      it('regects an incorrect answer', function() {
        view.find('.answer').val('false');
        view.find('.check-btn').click();
        expect(learnjs.flashElement).toHaveBeenCalledWith(resultFlash, 'Incorrect!');
      });
    });

  });

  describe('awsRefresh', function() {
    var callbackArg, fakeCreds;

    beforeEach(function() {
      fakeCreds = jasmine.createSpyObj('creds', ['refresh']);
      fakeCreds.identityId = 'COGNITO_ID';
      AWS.config.credentials = fakeCreds;
      fakeCreds.refresh.and.callFake(function(cb) { cb(callbackArg); });
    });

    it('returns a promise that resolves on success', function(done) {
      learnjs.awsRefresh().then(function(id) {
        expect(id).toEqual('COGNITO_ID');
      }).then(done, fail);
    });
    it('rejects the promise on a failure', function(done) {
      callbackArg = 'error';
      learnjs.awsRefresh().fail(function(err) {
        expect(err).toEqual("error");
        done();
      });
    });
  });

  describe('googleSignIn callback', function() {
    var user, profile;

    beforeEach(function() {
      profile = jasmine.createSpyObj('profile', ['getEmail']);
      var refreshPromise = new $.Deferred().resolve("COGNITO_ID").promise();
      spyOn(learnjs, 'awsRefresh').and.returnValue(refreshPromise);
      spyOn(AWS, 'CognitoIdentityCredentials');
      user = jasmine.createSpyObj('user',
          ['getAuthResponse', 'getBasicProfile']);
      user.getAuthResponse.and.returnValue({id_token: 'GOOGLE_ID'});
      user.getBasicProfile.and.returnValue(profile);
      profile.getEmail.and.returnValue('foo@bar.com');
      googleSignIn(user);
    });

    it('sets the AWS region', function() {
      expect(AWS.config.region).toEqual('ap-northeast-1');
    });

    it('sets the identity pool ID and Google ID token', function() {
      expect(AWS.CognitoIdentityCredentials).toHaveBeenCalledWith({
        IdentityPoolId: learnjs.poolId,
        Logins: {
          'accounts.google.com': 'GOOGLE_ID'
        }
      });
    });

    it('fetches the AWS credentials and resolved the deferred', function(done) {
        learnjs.identity.done(function(identity) {
          expect(identity.email).toEqual('foo@bar.com');
          expect(identity.id).toEqual('COGNITO_ID');
          done();
        });
      });

    describe('refresh', function() {
      var instanceSpy;
      beforeEach(function() {
        AWS.config.credentials = {params: {Logins: {}}};
        var updateSpy = jasmine.createSpyObj('userUpdate', ['getAuthResponse']);
        updateSpy.getAuthResponse.and.returnValue({id_token: "GOOGLE_ID"});
        instanceSpy = jasmine.createSpyObj('instance', ['signIn']);
        instanceSpy.signIn.and.returnValue(Promise.resolve(updateSpy));
        var auth2Spy = jasmine.createSpyObj('auth2', ['getAuthInstance']);
        auth2Spy.getAuthInstance.and.returnValue(instanceSpy);
        window.gapi = { auth2: auth2Spy };
      });

      it('returns a promise when token is refreshed', function(done) {
        learnjs.identity.done(function(identity) {
          identity.refresh().then(function() {
            expect(AWS.config.credentials.params.Logins).toEqual({
              'accounts.google.com': "GOOGLE_ID"
            });
            done();
          });
        });
      });

      it('does not re-prompt for consent when refreshing the token in', function(done) {
        learnjs.identity.done(function(identity) {
          identity.refresh().then(function() {
            expect(instanceSpy.signIn).toHaveBeenCalledWith({prompt: 'login'});
            done();
          });
        });
      });
    });
  });

});
