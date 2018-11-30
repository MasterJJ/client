// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters/index'
import * as Styles from '../../../../../styles'

export type Props = {
  imageURL: string,
  faviconURL?: string,
  onClose?: () => void,
}

class UnfurlGiphy extends React.Component<Props> {
  render() {
    return (
      <Kb.Box2 style={styles.container} gap="tiny" direction="horizontal">
        {!Styles.isMobile && <Kb.Box2 direction="horizontal" style={styles.quoteContainer} />}
        <Kb.Box2 style={styles.innerContainer} gap="xtiny" direction="vertical">
          <Kb.Box2 style={styles.siteNameContainer} gap="tiny" fullWidth={true} direction="horizontal">
            <Kb.Box2 direction="horizontal" gap="tiny">
              {!!this.props.faviconURL && <Kb.Image src={this.props.faviconURL} style={styles.favicon} />}
              <Kb.Text type="BodySmall">Giphy</Kb.Text>
            </Kb.Box2>
            {!!this.props.onClose && (
              <Kb.Icon
                type="iconfont-close"
                onClick={this.props.onClose}
                className="unfurl-closebox"
                fontSize={12}
              />
            )}
          </Kb.Box2>
          <Kb.Image src={this.props.imageURL} style={styles.image} />
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
    },
    isElectron: {
      maxWidth: 500,
    },
    isMobile: {
      paddingRight: 66,
    },
  }),
  favicon: {
    width: 16,
    height: 16,
    borderRadius: Styles.borderRadius,
  },
  siteNameContainer: {
    alignSelf: 'flex-start',
    justifyContent: 'space-between',
  },
  image: {
    maxWidth: 320,
    maxHeight: 250,
  },
  quoteContainer: {
    backgroundColor: Styles.globalColors.lightGrey,
    paddingLeft: Styles.globalMargins.xtiny,
    alignSelf: 'stretch',
  },
  innerContainer: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      minWidth: 150,
    },
    isMobile: {
      borderWidth: 1,
      borderRadius: Styles.borderRadius,
      borderColor: Styles.globalColors.lightGrey,
      padding: Styles.globalMargins.tiny,
    },
  }),
})

export default UnfurlGiphy
